import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'

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
}
