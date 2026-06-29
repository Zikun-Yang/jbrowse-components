import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'

import SingleCellBamAdapter from './SingleCellBamAdapter.ts'
import SingleCellBamAdapterConfigSchema from './SingleCellBamAdapterConfigSchema.ts'
import SingleCellZarrAdapter from './SingleCellZarrAdapter.ts'
import configSchema from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function SingleCellAdapterF(pluginManager: PluginManager) {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'SingleCellZarrAdapter',
        configSchema,
        AdapterClass: SingleCellZarrAdapter,
      }),
  )

  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'SingleCellBamAdapter',
        configSchema: SingleCellBamAdapterConfigSchema,
        getAdapterClass: () =>
          import('./SingleCellBamAdapter.ts').then(r => r.default),
      }),
  )
}
