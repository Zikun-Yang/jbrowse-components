import { lazy } from 'react'

import configSchema from './configSchema.ts'
import FeatureChartRenderer from './FeatureChartRenderer.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function FeatureChartRendererF(pluginManager: PluginManager) {
  pluginManager.addRendererType(() => {
    return new FeatureChartRenderer({
      name: 'FeatureChartRenderer',
      displayName: 'Feature chart renderer',
      configSchema,
      ReactComponent: lazy(
        () => import('./components/FeatureChartRendering.tsx'),
      ),
      pluginManager,
    })
  })
}
