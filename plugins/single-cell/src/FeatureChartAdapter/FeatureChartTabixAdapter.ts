import { TabixIndexedFile } from '@gmod/tabix'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { SimpleFeature } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { checkStopToken } from '@jbrowse/core/util/stopToken'

import configSchema from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { getSubAdapterType } from '@jbrowse/core/data_adapters/dataAdapterCache'
import type { Feature, FileLocation, Region } from '@jbrowse/core/util'

export interface ChartContextData {
  data: unknown
  description?: string
  name: string
}

export default class FeatureChartTabixAdapter extends BaseFeatureDataAdapter {
  private dataFile: TabixIndexedFile

  public static capabilities = ['getFeatures', 'getRefNames']

  private setupP?: Promise<{
    meta: Awaited<ReturnType<TabixIndexedFile['getMetadata']>>
  }>

  public constructor(
    config: AnyConfigurationModel,
    getSubAdapter?: getSubAdapterType,
    pluginManager?: PluginManager,
  ) {
    super(config, getSubAdapter, pluginManager)
    const dataLoc = this.getConf('dataLocation') as FileLocation
    const type = this.getConf(['index', 'indexType'])
    const loc = this.getConf(['index', 'location'])
    const pm = this.pluginManager

    this.dataFile = new TabixIndexedFile({
      filehandle: openLocation(dataLoc, pm),
      csiFilehandle: type === 'CSI' ? openLocation(loc, pm) : undefined,
      tbiFilehandle: type !== 'CSI' ? openLocation(loc, pm) : undefined,
      chunkCacheSize: 50 * 2 ** 20,
    })
  }

  public async getRefNames(opts: BaseOptions = {}) {
    return this.dataFile.getReferenceSequenceNames(opts)
  }

  async getMetadataPre() {
    const meta = await this.dataFile.getMetadata()
    return { meta }
  }

  async getMetadataPre2(_opts?: BaseOptions) {
    if (!this.setupP) {
      this.setupP = this.getMetadataPre().catch((e: unknown) => {
        this.setupP = undefined
        throw e
      })
    }
    return this.setupP
  }

  public getFeatures(query: Region, opts?: BaseOptions) {
    const { stopToken } = opts || {}
    return ObservableCreate<Feature>(async observer => {
      const { meta } = await this.getMetadataPre2(opts)
      const { columnNumbers } = meta
      const colRef = columnNumbers.ref - 1
      const colStart = columnNumbers.start - 1
      const colEnd = columnNumbers.end - 1

      let start = performance.now()
      checkStopToken(stopToken)
      await this.dataFile.getLines(query.refName, query.start, query.end, {
        lineCallback: (line: string, fileOffset: number) => {
          if (performance.now() - start > 500) {
            checkStopToken(stopToken)
            start = performance.now()
          }
          const feature = this.parseLine(line, fileOffset, {
            colRef,
            colStart,
            colEnd,
          })
          if (feature) {
            observer.next(feature)
          }
        },
      })
      observer.complete()
    }, stopToken)
  }

  private parseLine(
    line: string,
    fileOffset: number,
    columns: { colRef: number; colStart: number; colEnd: number },
  ): Feature | undefined {
    const cols = line.split('\t')
    const { colRef, colStart, colEnd } = columns

    if (cols.length < 5) {
      return undefined
    }

    const refName = cols[colRef]
    const start = parseInt(cols[colStart]!, 10)
    const end = parseInt(cols[colEnd]!, 10)
    const name = cols[3]
    const dataCol = cols[4]
    const description = cols[5]

    if (!refName || Number.isNaN(start) || Number.isNaN(end) || !dataCol) {
      return undefined
    }

    let data: unknown
    try {
      data = JSON.parse(dataCol)
    } catch {
      // Invalid JSON, skip this line
      return undefined
    }

    const contextData: ChartContextData = {
      data,
      name: name || '',
      description,
    }

    return new SimpleFeature({
      id: `${this.id}-${fileOffset}`,
      data: {
        refName,
        start,
        end,
        name: name || '',
        contextData,
      },
    })
  }
}

export { configSchema }
