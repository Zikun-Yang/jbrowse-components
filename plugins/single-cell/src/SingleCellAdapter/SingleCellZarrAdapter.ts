import { BaseAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { openArray, openGroup } from 'zarr'

import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter/BaseOptions'
import type { getSubAdapterType } from '@jbrowse/core/data_adapters/dataAdapterCache'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { Feature } from '@jbrowse/core/util'
import type { Region } from '@jbrowse/core/util/types'

/**
 * Data adapter for single-cell AnnData stored in Zarr format.
 *
 * This adapter reads the standard AnnData-on-Zarr layout:
 *   zarr/
 *     obs/          cell metadata (DataFrame)
 *     var/          feature/gene metadata (DataFrame)
 *     obsm/         embeddings (e.g. X_umap)
 *     X/            expression matrix
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
    const obsmGroup = await this.root.getItem('obsm')
    if (obsmGroup && typeof obsmGroup === 'object' && 'keys' in obsmGroup) {
      this._embeddings = await (obsmGroup as { keys(): Promise<string[]> }).keys()
    }

    // Get dimensions from X shape
    try {
      const xArray = await openArray({ store: this.root.store, path: 'X', mode: 'r' })
      const shape = xArray.shape
      this._nObs = shape[0] ?? 0
      this._nVar = shape[1] ?? 0
    } catch {
      // X may be stored as sparse (data/indices/indptr); fallback to obs shape
      try {
        const obsGroup = await this.root.getItem('obs')
        if (obsGroup && typeof obsGroup === 'object' && 'getItem' in obsGroup) {
          const indexItem = await (obsGroup as { getItem(name: string): Promise<unknown> }).getItem('__categories')
          if (indexItem && typeof indexItem === 'object' && 'shape' in indexItem) {
            this._nObs = (indexItem as { shape: number[] }).shape[0] ?? 0
          }
        }
      } catch {
        // ignore
      }
    }

    // Detect obs columns
    try {
      const obsGroup = await this.root.getItem('obs')
      if (obsGroup && typeof obsGroup === 'object' && 'keys' in obsGroup) {
        this._obsColumns = await (obsGroup as { keys(): Promise<string[]> }).keys()
      }
    } catch {
      // ignore
    }

    // Detect var columns
    try {
      const varGroup = await this.root.getItem('var')
      if (varGroup && typeof varGroup === 'object' && 'keys' in varGroup) {
        this._varColumns = await (varGroup as { keys(): Promise<string[]> }).keys()
      }
    } catch {
      // ignore
    }

    this.initialized = true
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
      mode: 'r',
    })
    const data = (await arr.get()) as number[] | Float32Array | Int32Array
    return new Float32Array(data as number[])
  }

  /**
   * Read a single obs column. Returns raw array; caller handles categorical decoding.
   */
  async getObsColumn(name: string): Promise<unknown> {
    await this.init()
    if (!this.root) {
      throw new Error('Adapter not initialized')
    }
    const arr = await openArray({
      store: this.root.store,
      path: `obs/${name}`,
      mode: 'r',
    })
    return arr.get()
  }

  /**
   * Read a single var column.
   */
  async getVarColumn(name: string): Promise<unknown> {
    await this.init()
    if (!this.root) {
      throw new Error('Adapter not initialized')
    }
    const arr = await openArray({
      store: this.root.store,
      path: `var/${name}`,
      mode: 'r',
    })
    return arr.get()
  }

  /**
   * Read expression for a single gene across all cells.
   * This requires the X matrix to be accessible; for large datasets
   * this may be slow and should be used sparingly.
   */
  async getExpression(geneName: string): Promise<Float32Array> {
    await this.init()
    if (!this.root) {
      throw new Error('Adapter not initialized')
    }
    // TODO: implement gene name -> var index lookup, then slice X[:, index]
    // For now, placeholder returning zeros
    return new Float32Array(this._nObs)
  }

  // Standard JBrowse adapter interface (not used for single-cell directly,
  // but required by BaseAdapter)
  public async getRefNames(_opts?: BaseOptions) {
    return []
  }

  public async getFeatures(_region: Region, _opts?: BaseOptions) {
    // Single-cell data is not feature-based in the genome sense;
    // this adapter exposes its own API above.
    return []
  }

  public async getHeader() {
    return {}
  }

  public freeResources(): void {}
}
