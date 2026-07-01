import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'

import configSchema from './configSchema.ts'
import FeatureChartTabixAdapter from './FeatureChartTabixAdapter.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function FeatureChartAdapterF(pluginManager: PluginManager) {
  pluginManager.addAdapterType(() => {
    return new AdapterType({
      name: 'FeatureChartTabixAdapter',
      displayName: 'Feature chart Tabix adapter',
      configSchema,
      AdapterClass: FeatureChartTabixAdapter,
    })
  })
}
