import { BaseAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { openArray, openGroup, slice } from 'zarr'

import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter/BaseOptions'
import type { getSubAdapterType } from '@jbrowse/core/data_adapters/dataAdapterCache'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { Feature } from '@jbrowse/core/util'
import type { Region } from '@jbrowse/core/util/types'

type TypedArray =
  | Int8Array
  | Uint8Array
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Float32Array
  | Float64Array

/**
 * zarr.js returns 2D arrays as an array of 1D typed-array rows. Flatten that
 * into a single 1D typed/array so callers don't need to know the chunk shape.
 */
function flattenNestedData(nested: {
  data: TypedArray | TypedArray[] | string[] | number[]
}): TypedArray | string[] | number[] {
  const raw = nested.data
  if (Array.isArray(raw)) {
    if (raw.length === 0) {
      return new Float32Array()
    }
    const first = raw[0]
    if (first && ArrayBuffer.isView(first)) {
      const arrays = raw as TypedArray[]
      const total = arrays.reduce((sum, a) => sum + a.length, 0)
      const ctor = first.constructor as new (n: number) => TypedArray
      const result = new ctor(total)
      let offset = 0
      for (const a of arrays) {
        result.set(a, offset)
        offset += a.length
      }
      return result
    }
  }
  return raw as TypedArray | string[] | number[]
}

/**
 * Decode a vlen-utf8 encoded byte buffer into an array of strings.
 * Format: uint32 count, then for each string uint32 length + UTF-8 bytes.
 */
function decodeVlenUtf8(buffer: ArrayBuffer): string[] {
  const view = new DataView(buffer)
  const bytes = new Uint8Array(buffer)
  let offset = 0
  const n = view.getUint32(offset, true)
  offset += 4
  const result: string[] = []
  const decoder = new TextDecoder()
  for (let i = 0; i < n; i++) {
    const len = view.getUint32(offset, true)
    offset += 4
    const strBytes = bytes.slice(offset, offset + len)
    result.push(decoder.decode(strBytes))
    offset += len
  }
  return result
}

/**
 * Read a vlen-utf8 encoded string Zarr array (e.g. cell barcodes or category
 * labels). zarr.js 0.6.3 does not support the vlen-utf8 filter natively, so we
 * manually decode the decompressed chunk bytes.
 */
async function readVlenUtf8Array(
  arr: Awaited<ReturnType<typeof openArray>>,
): Promise<string[]> {
  const result: string[] = []
  const nChunks = Math.ceil(arr.shape[0]! / arr.chunks[0]!)
  for (let i = 0; i < nChunks; i++) {
    const raw = await arr.chunkStore.getItem(arr.chunkKey([i]))
    const decoded = await arr.decodeChunk(raw)
    result.push(...decodeVlenUtf8(decoded))
  }
  return result
}

/**
 * Determine whether a Zarr array uses the vlen-utf8 filter.
 */
function isVlenUtf8Array(arr: Awaited<ReturnType<typeof openArray>>): boolean {
  const meta = (arr as unknown as { meta?: { filters?: { id: string }[] } })
    .meta
  if (!meta?.filters) return false
  return meta.filters.some(f => f.id === 'vlen-utf8')
}

/**
 * Simple LRU cache backed by a Map. JavaScript Maps preserve insertion order,
 * so the oldest entry is always the first key.
 */
class LRUCache<K, V> {
  private cache = new Map<K, V>()

  constructor(private maxSize: number) {}

  has(key: K): boolean {
    return this.cache.has(key)
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key)
    if (!this.cache.has(key)) {
      return undefined
    }
    // Move to end (most recently used).
    this.cache.delete(key)
    this.cache.set(key, value as V)
    return value as V
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key)
    } else if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value
      if (firstKey !== undefined) {
        this.cache.delete(firstKey)
      }
    }
    this.cache.set(key, value)
  }
}

/**
 * Decoded categorical column: integer codes mapped to string labels.
 */
export interface CategoricalColumn {
  type: 'categorical'
  codes: Int32Array
  categories: string[]
}

/**
 * Decoded continuous column: raw numeric values.
 */
export interface ContinuousColumn {
  type: 'continuous'
  values: Float32Array
}

/**
 * Decoded string column (e.g. cell barcodes from obs index).
 */
export interface StringColumn {
  type: 'string'
  values: string[]
}

export type ObsColumn = CategoricalColumn | ContinuousColumn | StringColumn

/**
 * Data adapter for single-cell AnnData stored in Zarr format.
 *
 * This adapter reads the standard AnnData-on-Zarr layout:
 *   zarr/
 *     obs/          cell metadata (DataFrame)
 *     var/          feature/gene metadata (DataFrame)
 *     obsm/         embeddings (e.g. X_umap)
 *     X/            expression matrix (dense or sparse)
 *     uns/          unstructured annotations
 *
 * For browser compatibility, users should convert .h5ad to Zarr via:
 *   import scanpy as sc
 *   adata = sc.read_h5ad('input.h5ad')
 *   adata.write_zarr('output.zarr/')
 */
export default class SingleCellZarrAdapter extends BaseAdapter {
  private initialized = false
  private root: Awaited<ReturnType<typeof openGroup>> | undefined
  private _nObs = 0
  private _nVar = 0
  private _obsColumns: string[] = []
  private _varColumns: string[] = []
  private _embeddings: string[] = []
  private _varNames: string[] = []
  private _varNameToIndex: Map<string, number> = new Map()
  private _isDenseX = false
  private _expressionCache = new LRUCache<string, Float32Array>(100)
  private _sparseIndptr: number[] | undefined
  private _sparseData: number[] | undefined
  private _sparseIndices: number[] | undefined

  constructor(
    config: AnyConfigurationModel,
    getSubAdapter?: getSubAdapterType,
    pluginManager?: PluginManager,
  ) {
    super(config, getSubAdapter, pluginManager)
  }

  async init() {
    if (this.initialized) {
      return
    }
    const zarrLocation = this.getConf('zarrLocation') as { uri: string }
    let uri = zarrLocation.uri
    if (!uri) {
      throw new Error('No zarrLocation configured for SingleCellZarrAdapter')
    }
    // Zarr stores are directories; a trailing slash ensures zarr.js resolves
    // relative item paths (e.g. .zgroup, obsm/) under the store.
    if (!uri.endsWith('/')) {
      uri += '/'
    }

    this.root = await openGroup(uri)

    // Detect available embeddings from obsm
    try {
      const obsmGroup = await this.root.getItem('obsm')
      if (obsmGroup && 'getItem' in obsmGroup) {
        // obsm is a group, list its children
        const group = obsmGroup as Awaited<ReturnType<typeof openGroup>>
        this._embeddings = await this._listGroupKeys(group, [
          'X_umap',
          'X_tsne',
          'X_pca',
          'X_draw_graph_fa',
          'X_phate',
          'X_diffmap',
          'X_pca_harmony',
          'X_scvi',
          'X_scanvi',
        ])
      }
    } catch {
      // obsm may not exist
    }

    // Detect obs columns
    try {
      const obsGroup = await this.root.getItem('obs')
      if (obsGroup && 'getItem' in obsGroup) {
        const group = obsGroup as Awaited<ReturnType<typeof openGroup>>
        const keys = await this._listGroupKeys(group, [
          'cell_type',
          'leiden',
          'louvain',
          'cluster',
          'clusters',
          'seurat_clusters',
          'sample',
          'batch',
          'condition',
          'treatment',
          'timepoint',
          'donor',
          'library',
          'phase',
          'n_counts',
          'n_genes',
          'n_genes_by_counts',
          'total_counts',
          'pct_counts_mt',
          'percent_mito',
          'doublet_score',
          'G2M_score',
          'S_score',
          'orig_ident',
          'predicted_cell_type',
        ])
        this._obsColumns = keys.filter(k => k !== '__categories')
      }
    } catch {
      // ignore
    }

    // Detect var columns
    try {
      const varGroup = await this.root.getItem('var')
      if (varGroup && 'getItem' in varGroup) {
        const group = varGroup as Awaited<ReturnType<typeof openGroup>>
        const keys = await this._listGroupKeys(group, [
          'gene_ids',
          'gene_name',
          'gene_symbols',
          'symbol',
          'feature_name',
          'feature_id',
          'features',
          'index',
          '_index',
        ])
        this._varColumns = keys.filter(k => k !== '__categories')
      }
    } catch {
      // ignore
    }

    // Determine dimensions and X format
    await this._detectDimensionsAndXFormat()

    // Build gene name index from var
    await this._buildVarNameIndex()

    this.initialized = true
  }

  private async _listGroupKeys(
    group: Awaited<ReturnType<typeof openGroup>>,
    candidates?: string[],
  ): Promise<string[]> {
    // AnnData DataFrames store their column names in the group's .zattrs under
    // "column-order". Prefer that when available because HTTPStore does not
    // implement keys().
    const attrs = await group.attrs.asObject()
    const columnOrder = attrs['column-order'] as string[] | undefined
    if (columnOrder?.length) {
      return columnOrder
    }

    // Fallback: use the store's keys() when the store supports it (e.g. with
    // consolidated .zmetadata or filesystem stores).
    try {
      const store = group.store as {
        keys(): Promise<string[]> | string[]
      }
      const allKeys = await store.keys()
      const prefix = group.path === '/' ? '' : group.path + '/'
      const childSet = new Set<string>()
      for (const key of allKeys) {
        if (key.startsWith(prefix)) {
          const remainder = key.slice(prefix.length)
          const firstSegment = remainder.split('/')[0]
          if (firstSegment && !firstSegment.startsWith('.')) {
            childSet.add(firstSegment)
          }
        }
      }
      const result = [...childSet]
      if (result.length) {
        return result
      }
    } catch {
      // continue to candidate fallback
    }

    // Final fallback: test a list of candidate names with containsItem. Used for
    // obsm embeddings when HTTPStore can't list keys.
    if (candidates?.length) {
      const found: string[] = []
      for (const name of candidates) {
        if (await group.containsItem(name)) {
          found.push(name)
        }
      }
      return found
    }

    return []
  }

  private async _detectDimensionsAndXFormat() {
    if (!this.root) return

    // Try dense X first
    try {
      const xArray = await openArray({ store: this.root.store, path: 'X' })
      const shape = xArray.shape
      this._nObs = shape[0] ?? 0
      this._nVar = shape[1] ?? 0
      this._isDenseX = true
      return
    } catch {
      // X is not a dense array; try sparse
    }

    // Try sparse X: AnnData stores sparse matrices as a group with
    // data/indices/indptr and the shape in .zattrs.
    try {
      const xGroup = await openGroup(this.root.store, 'X')
      const xAttrs = await xGroup.attrs.asObject()
      const shape = xAttrs.shape as number[] | undefined
      if (shape?.length === 2) {
        this._nObs = shape[0] ?? 0
        this._nVar = shape[1] ?? 0
        this._isDenseX = false
        return
      }
    } catch {
      // fallback below
    }

    // fallback: use obs column length
    try {
      if (this._obsColumns.length > 0) {
        const firstCol = await openArray({
          store: this.root.store,
          path: `obs/${this._obsColumns[0]}`,
        })
        this._nObs = firstCol.shape[0] ?? 0
      }
    } catch {
      // ignore
    }
  }

  private async _readVarNamesFromColumn(
    col: string,
  ): Promise<string[] | undefined> {
    if (!this.root) return undefined
    try {
      const arr = await openArray({
        store: this.root.store,
        path: `var/${col}`,
      })
      let names: string[]
      if (isVlenUtf8Array(arr)) {
        names = await readVlenUtf8Array(arr)
      } else {
        const nested = await arr.get()
        if (!nested || typeof nested !== 'object' || !('data' in nested)) {
          return undefined
        }
        const data = flattenNestedData(
          nested as { data: TypedArray | TypedArray[] },
        )
        names = Array.from(data as unknown as string[])
      }
      return names.map(String)
    } catch {
      return undefined
    }
  }

  private async _buildVarNameIndex() {
    if (!this.root || this._nVar === 0) return

    const candidateCols = [
      this.getConf('varIndexColumn') as string,
      'gene_ids',
      'gene_name',
      'gene_symbols',
      'symbol',
      'feature_name',
      'feature_id',
      'features',
      'index',
      '_index',
    ]

    for (const col of candidateCols) {
      if (!col) continue
      const names = await this._readVarNamesFromColumn(col)
      if (names && names.length > 0) {
        this._varNames = names
        break
      }
    }

    // Fallback: scan detected var columns for any string column
    if (this._varNames.length === 0) {
      for (const col of this._varColumns) {
        const names = await this._readVarNamesFromColumn(col)
        if (names && names.length > 0) {
          this._varNames = names
          break
        }
      }
    }

    // Fallback: use numeric indices
    if (this._varNames.length === 0) {
      this._varNames = Array.from({ length: this._nVar }, (_, i) => String(i))
    }

    // Build lookup map
    this._varNameToIndex = new Map(this._varNames.map((name, i) => [name, i]))
  }

  get nObs() {
    return this._nObs
  }

  get nVar() {
    return this._nVar
  }

  get obsColumns() {
    return this._obsColumns
  }

  get varColumns() {
    return this._varColumns
  }

  get embeddings() {
    return this._embeddings
  }

  get varNames() {
    return this._varNames
  }

  /**
   * Read a 2D embedding (e.g. X_umap) as Float32Array in [x0,y0,x1,y1,...] layout.
   *
   * Embeddings such as X_pca may have more than two components (shape
   * [n_obs, n_components]); only the first two dimensions are returned for
   * visualization.
   */
  async getEmbedding(name: string): Promise<Float32Array> {
    await this.init()
    if (!this.root) {
      throw new Error('Adapter not initialized')
    }
    const arr = await openArray({
      store: this.root.store,
      path: `obsm/${name}`,
    })
    const nComponents = arr.shape[1] ?? 0
    const nested =
      nComponents > 2 ? await arr.get([null, slice(0, 2)]) : await arr.get()
    if (nested && typeof nested === 'object' && 'data' in nested) {
      return new Float32Array(
        flattenNestedData(
          nested as { data: TypedArray | TypedArray[] },
        ) as unknown as number[],
      )
    }
    throw new Error(`Failed to read embedding ${name}`)
  }

  /**
   * Read and decode a single obs column.
   * Automatically handles categorical columns (codes + categories) and string columns.
   */
  async getObsColumn(name: string): Promise<ObsColumn> {
    await this.init()
    if (!this.root) {
      throw new Error('Adapter not initialized')
    }

    // Newer AnnData-on-Zarr stores categorical columns as groups containing
    // `codes` and `categories` arrays (encoding-type: "categorical").
    try {
      const group = await openGroup(this.root.store, `obs/${name}`)
      const attrs = await group.attrs.asObject()
      if (attrs['encoding-type'] === 'categorical') {
        const codesArr = await openArray({
          store: this.root.store,
          path: `obs/${name}/codes`,
        })
        const catArr = await openArray({
          store: this.root.store,
          path: `obs/${name}/categories`,
        })
        const codesNested = await codesArr.get()
        if (
          !codesNested ||
          typeof codesNested !== 'object' ||
          !('data' in codesNested)
        ) {
          throw new Error(`Failed to read categorical codes for ${name}`)
        }
        const codesData = flattenNestedData(
          codesNested as { data: TypedArray | TypedArray[] },
        )
        const categories = isVlenUtf8Array(catArr)
          ? await readVlenUtf8Array(catArr)
          : Array.from(
              flattenNestedData(
                (await catArr.get()) as { data: TypedArray | TypedArray[] },
              ) as unknown as string[],
            )
        return {
          type: 'categorical',
          codes: new Int32Array(codesData as unknown as number[]),
          categories,
        }
      }
    } catch {
      // Not a group-encoded categorical column; fall through to array path.
    }

    // Read the codes/values array
    const codesArr = await openArray({
      store: this.root.store,
      path: `obs/${name}`,
    })

    // String columns (commonly vlen-utf8 encoded cell barcodes)
    if (isVlenUtf8Array(codesArr)) {
      const values = await readVlenUtf8Array(codesArr)
      return { type: 'string', values }
    }

    const codesNested = await codesArr.get()
    if (
      !codesNested ||
      typeof codesNested !== 'object' ||
      !('data' in codesNested)
    ) {
      throw new Error(`Failed to read obs column ${name}`)
    }
    const codesData = flattenNestedData(
      codesNested as { data: TypedArray | TypedArray[] },
    )

    // Try to read categories (legacy __categories layout)
    try {
      const catArr = await openArray({
        store: this.root.store,
        path: `obs/__categories/${name}`,
      })
      const categories = isVlenUtf8Array(catArr)
        ? await readVlenUtf8Array(catArr)
        : Array.from(
            flattenNestedData(
              (await catArr.get()) as { data: TypedArray | TypedArray[] },
            ) as unknown as string[],
          )
      return {
        type: 'categorical',
        codes: new Int32Array(codesData as unknown as number[]),
        categories,
      }
    } catch {
      // No categories
    }

    // Detect string columns that were decoded normally
    if (
      codesData.length > 0 &&
      typeof (codesData as unknown as (string | number)[])[0] === 'string'
    ) {
      return {
        type: 'string',
        values: Array.from(codesData as unknown as string[]),
      }
    }

    return {
      type: 'continuous',
      values: new Float32Array(codesData as unknown as number[]),
    }
  }

  /**
   * Read a single var column.
   */
  async getVarColumn(name: string): Promise<TypedArray> {
    await this.init()
    if (!this.root) {
      throw new Error('Adapter not initialized')
    }
    const arr = await openArray({ store: this.root.store, path: `var/${name}` })
    const nested = await arr.get()
    if (nested && typeof nested === 'object' && 'data' in nested) {
      return flattenNestedData(
        nested as { data: TypedArray | TypedArray[] },
      ) as TypedArray
    }
    throw new Error(`Failed to read var column ${name}`)
  }

  /**
   * Read expression for a single gene across all cells.
   *
   * Uses Zarr slicing so only the requested column is fetched, and caches the
   * result so repeated clicks on the same gene are instant.
   */
  async getExpression(geneName: string): Promise<Float32Array> {
    await this.init()
    if (!this.root) {
      throw new Error('Adapter not initialized')
    }

    const cached = this._expressionCache.has(geneName)
      ? this._expressionCache.get(geneName)
      : undefined
    if (cached) {
      return cached
    }

    const geneIndex = this._varNameToIndex.get(geneName)
    if (geneIndex === undefined) {
      throw new Error(`Gene ${geneName} not found in var index`)
    }

    const result = await this._readExpression(geneIndex)
    this._expressionCache.set(geneName, result)
    return result
  }

  private async _readExpression(geneIndex: number): Promise<Float32Array> {
    if (!this.root) {
      throw new Error('Adapter not initialized')
    }

    if (this._isDenseX) {
      return this._readDenseExpression(geneIndex)
    }
    return this._readSparseExpression(geneIndex)
  }

  private async _readDenseExpression(geneIndex: number): Promise<Float32Array> {
    const xArr = await openArray({ store: this.root!.store, path: 'X' })
    // Read only the requested column: X[:, geneIndex]. zarr.js may return the
    // result as a nested list of per-chunk rows, so flatten it.
    const nested = await xArr.get([slice(null, null), geneIndex])
    const result = new Float32Array(this._nObs)
    if (nested && typeof nested === 'object' && 'data' in nested) {
      const data = flattenNestedData(
        nested as { data: TypedArray | TypedArray[] },
      ) as unknown as number[]
      for (let i = 0; i < this._nObs; i++) {
        result[i] = data[i] ?? 0
      }
    }
    return result
  }

  private async _readSparseExpression(
    geneIndex: number,
  ): Promise<Float32Array> {
    const result = new Float32Array(this._nObs)
    if (!this.root) {
      return result
    }

    try {
      const dataArr = await openArray({
        store: this.root.store,
        path: 'X/data',
      })
      const indicesArr = await openArray({
        store: this.root.store,
        path: 'X/indices',
      })
      const indptrArr = await openArray({
        store: this.root.store,
        path: 'X/indptr',
      })

      // indptr is small (nObs+1 or nVar+1); cache it after the first read so
      // subsequent gene lookups don't re-fetch the pointer array.
      if (!this._sparseIndptr) {
        const indptrNested = await indptrArr.get()
        if (
          indptrNested &&
          typeof indptrNested === 'object' &&
          'data' in indptrNested
        ) {
          this._sparseIndptr = flattenNestedData(
            indptrNested as { data: TypedArray | TypedArray[] },
          ) as unknown as number[]
        }
      }
      const indptr = this._sparseIndptr
      if (!indptr) {
        return result
      }

      const isCSC = indptr.length === this._nVar + 1

      if (isCSC) {
        // CSC: indptr is column-oriented, so a single column is a contiguous
        // slice of data/indices.
        const colStart = indptr[geneIndex] ?? 0
        const colEnd = indptr[geneIndex + 1] ?? 0
        if (colEnd > colStart) {
          const [dataNested, indicesNested] = await Promise.all([
            dataArr.get([slice(colStart, colEnd)]),
            indicesArr.get([slice(colStart, colEnd)]),
          ])
          if (
            dataNested &&
            typeof dataNested === 'object' &&
            'data' in dataNested &&
            indicesNested &&
            typeof indicesNested === 'object' &&
            'data' in indicesNested
          ) {
            const values = flattenNestedData(
              dataNested as { data: TypedArray | TypedArray[] },
            ) as unknown as number[]
            const indices = flattenNestedData(
              indicesNested as { data: TypedArray | TypedArray[] },
            ) as unknown as number[]
            for (let k = 0; k < values.length; k++) {
              const row = indices[k]
              if (row !== undefined && row < this._nObs) {
                result[row] = values[k] ?? 0
              }
            }
          }
        }
      } else {
        // CSR: indptr is row-oriented. A column read requires scanning every
        // row, so we cache the full data/indices arrays after the first read.
        if (!this._sparseData || !this._sparseIndices) {
          const [dataNested, indicesNested] = await Promise.all([
            dataArr.get(),
            indicesArr.get(),
          ])
          if (
            dataNested &&
            typeof dataNested === 'object' &&
            'data' in dataNested &&
            indicesNested &&
            typeof indicesNested === 'object' &&
            'data' in indicesNested
          ) {
            this._sparseData = flattenNestedData(
              dataNested as { data: TypedArray | TypedArray[] },
            ) as unknown as number[]
            this._sparseIndices = flattenNestedData(
              indicesNested as { data: TypedArray | TypedArray[] },
            ) as unknown as number[]
          }
        }
        const values = this._sparseData
        const indices = this._sparseIndices
        if (!values || !indices) {
          return result
        }
        for (let row = 0; row < this._nObs; row++) {
          const rowStart = indptr[row] ?? 0
          const rowEnd = indptr[row + 1] ?? 0
          for (let k = rowStart; k < rowEnd; k++) {
            if (indices[k] === geneIndex) {
              result[row] = values[k] ?? 0
              break
            }
          }
        }
      }
    } catch {
      // sparse data unavailable
    }

    return result
  }

  // Standard JBrowse adapter interface
  public async getRefNames(_opts?: BaseOptions) {
    return []
  }

  public async getFeatures(_region: Region, _opts?: BaseOptions) {
    return []
  }

  public async getHeader() {
    return {}
  }

  public freeResources(): void {}
}
