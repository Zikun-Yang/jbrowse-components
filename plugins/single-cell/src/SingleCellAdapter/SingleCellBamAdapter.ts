import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'

import configSchema from './SingleCellBamAdapterConfigSchema.ts'

import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature } from '@jbrowse/core/util'
import type { AugmentedRegion as Region } from '@jbrowse/core/util/types'

export interface SingleCellBamAdapterOptions extends BaseOptions {
  selectedCells?: Set<string>
}

/**
 * Wraps a BAM/CRAM adapter and filters reads by a cell barcode tag.
 *
 * The set of selected barcodes is supplied dynamically through
 * `opts.selectedCells` (e.g. injected by SingleCellPileupDisplay). When the set
 * is empty or missing, all features are passed through unchanged.
 */
export default class SingleCellBamAdapter extends BaseFeatureDataAdapter {
  private subadapterRef?: BaseFeatureDataAdapter

  private configureResult?: { subadapter: BaseFeatureDataAdapter }

  protected async configure() {
    if (!this.configureResult) {
      const subadapterConfig = this.getConf('subadapter') as Record<
        string,
        unknown
      >
      if (!subadapterConfig) {
        throw new Error('SingleCellBamAdapter requires a subadapter config')
      }
      if (!this.getSubAdapter) {
        throw new Error('SingleCellBamAdapter requires getSubAdapter')
      }
      const { dataAdapter } = await this.getSubAdapter(subadapterConfig)
      const subadapter = dataAdapter as BaseFeatureDataAdapter
      this.subadapterRef = subadapter
      if (this.sequenceAdapterConfig) {
        subadapter.setSequenceAdapterConfig(this.sequenceAdapterConfig)
      }
      this.configureResult = { subadapter }
    }
    return this.configureResult
  }

  /**
   * Propagate sequence adapter config to the underlying BAM/CRAM adapter.
   */
  setSequenceAdapterConfig(config: Record<string, unknown>) {
    super.setSequenceAdapterConfig(config)
    this.subadapterRef?.setSequenceAdapterConfig(config)
  }

  async getRefNames(opts?: BaseOptions) {
    const { subadapter } = await this.configure()
    return subadapter.getRefNames(opts)
  }

  getFeatures(region: Region, opts: SingleCellBamAdapterOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      const { subadapter } = await this.configure()
      const selectedCells = opts.selectedCells
      const tag = (this.getConf('cellBarcodeTag') as string) || 'CB'
      const inner$ = subadapter.getFeatures(region, opts)
      if (!selectedCells?.size) {
        inner$.subscribe(observer)
      } else {
        inner$.subscribe({
          next: feature => {
            const barcode = feature.get(tag) as string | undefined
            if (barcode && selectedCells.has(barcode)) {
              observer.next(feature)
            }
          },
          error: err => observer.error(err),
          complete: () => observer.complete(),
        })
      }
    }, opts.stopToken)
  }

  async getMultiRegionFeatureDensityStats(
    regions: Region[],
    opts?: BaseOptions,
  ) {
    const { subadapter } = await this.configure()
    return subadapter.getMultiRegionFeatureDensityStats(regions, opts)
  }
}

export { configSchema }
