import { BaseAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { openArray, openGroup } from 'zarr'

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

export type ObsColumn = CategoricalColumn | ContinuousColumn

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
    const uri = zarrLocation.uri
    if (!uri) {
      throw new Error('No zarrLocation configured for SingleCellZarrAdapter')
    }

    this.root = await openGroup(uri)

    // Detect available embeddings from obsm
    try {
      const obsmGroup = await this.root.getItem('obsm')
      if (obsmGroup && 'getItem' in obsmGroup) {
        // obsm is a group, list its children
        const group = obsmGroup as Awaited<ReturnType<typeof openGroup>>
        this._embeddings = await this._listGroupKeys(group)
      }
    } catch {
      // obsm may not exist
    }

    // Detect obs columns
    try {
      const obsGroup = await this.root.getItem('obs')
      if (obsGroup && 'getItem' in obsGroup) {
        const group = obsGroup as Awaited<ReturnType<typeof openGroup>>
        const keys = await this._listGroupKeys(group)
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
        const keys = await this._listGroupKeys(group)
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
  ): Promise<string[]> {
    // zarr.js 0.6.3 Group doesn't expose a direct keys() method.
    // We use the store's keys() and filter for direct children.
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
    return [...childSet]
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

    // Try sparse X: check for data/indices/indptr
    try {
      const shapeArray = await openArray({ store: this.root.store, path: 'X/shape' })
      const shapeData = await shapeArray.get()
      if (shapeData && typeof shapeData === 'object' && 'data' in shapeData) {
        const shape = (shapeData as { data: TypedArray }).data
        this._nObs = shape[0] ?? 0
        this._nVar = shape[1] ?? 0
        this._isDenseX = false
      }
    } catch {
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
  }

  private async _buildVarNameIndex() {
    if (!this.root || this._nVar === 0) return

    // Try to get gene/feature names from var index or a 'gene_ids' / 'feature_name' column
    const nameColumn = this._varColumns.find(
      c => c === this.getConf('varIndexColumn') || c === 'gene_ids' || c === 'feature_name' || c === 'index',
    )

    if (nameColumn) {
      try {
        const arr = await openArray({ store: this.root.store, path: `var/${nameColumn}` })
        const nested = await arr.get()
        if (nested && typeof nested === 'object' && 'data' in nested) {
          const data = (nested as { data: TypedArray }).data
          this._varNames = Array.from(data as unknown as string[])
        }
      } catch {
        // ignore
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
    const nested = await arr.get()
    if (nested && typeof nested === 'object' && 'data' in nested) {
      return new Float32Array((nested as { data: TypedArray }).data)
    }
    throw new Error(`Failed to read embedding ${name}`)
  }

  /**
   * Read and decode a single obs column.
   * Automatically handles categorical columns (codes + categories).
   */
  async getObsColumn(name: string): Promise<ObsColumn> {
    await this.init()
    if (!this.root) {
      throw new Error('Adapter not initialized')
    }

    // Read the codes array
    const codesArr = await openArray({ store: this.root.store, path: `obs/${name}` })
    const codesNested = await codesArr.get()
    if (!codesNested || typeof codesNested !== 'object' || !('data' in codesNested)) {
      throw new Error(`Failed to read obs column ${name}`)
    }
    const codesData = (codesNested as { data: TypedArray }).data

    // Try to read categories
    try {
      const catArr = await openArray({
        store: this.root.store,
        path: `obs/__categories/${name}`,
      })
      const catNested = await catArr.get()
      if (catNested && typeof catNested === 'object' && 'data' in catNested) {
        const catData = (catNested as { data: TypedArray }).data
        const categories = Array.from(catData as unknown as string[])
        return {
          type: 'categorical',
          codes: new Int32Array(codesData as unknown as number[]),
          categories,
        }
      }
    } catch {
      // No categories: treat as continuous
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
      return (nested as { data: TypedArray }).data
    }
    throw new Error(`Failed to read var column ${name}`)
  }

  /**
   * Read expression for a single gene across all cells.
   */
  async getExpression(geneName: string): Promise<Float32Array> {
    await this.init()
    if (!this.root) {
      throw new Error('Adapter not initialized')
    }

    const geneIndex = this._varNameToIndex.get(geneName)
    if (geneIndex === undefined) {
      throw new Error(`Gene ${geneName} not found in var index`)
    }

    if (this._isDenseX) {
      // Dense: read X[:, geneIndex]
      const xArr = await openArray({ store: this.root.store, path: 'X' })
      // zarr.js 0.6.3: get a slice for the entire column
      // For now, read the full array and extract the column (inefficient but works)
      const nested = await xArr.get()
      if (nested && typeof nested === 'object' && 'data' in nested) {
        const data = (nested as { data: TypedArray }).data
        const result = new Float32Array(this._nObs)
        for (let i = 0; i < this._nObs; i++) {
          result[i] = (data as unknown as number[])[i * this._nVar + geneIndex] ?? 0
        }
        return result
      }
    } else {
      // Sparse: read CSC/CSR data and extract column
      // TODO: implement sparse column extraction
    }

    return new Float32Array(this._nObs)
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
