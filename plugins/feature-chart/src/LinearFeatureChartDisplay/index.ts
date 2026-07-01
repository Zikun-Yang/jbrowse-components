import { lazy } from 'react'

import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'

import configSchemaFactory from './configSchema.ts'
import modelFactory from './model.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function LinearFeatureChartDisplayF(
  pluginManager: PluginManager,
) {
  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaFactory(pluginManager)
    const stateModel = modelFactory(pluginManager, configSchema)
    return new DisplayType({
      name: 'LinearFeatureChartDisplay',
      displayName: 'Feature chart display',
      configSchema,
      stateModel,
      trackType: 'FeatureChartTrack',
      viewType: 'LinearGenomeView',
      ReactComponent: lazy(() => import('./components/DisplayComponent.tsx')),
    })
  })
}
