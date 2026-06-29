import { lazy } from 'react'
import RendererType from '@jbrowse/core/pluggableElementTypes/renderers/RendererType'

import configSchema from './configSchema.ts'
import FeatureChartRenderer from './FeatureChartRenderer.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function FeatureChartRendererF(pluginManager: PluginManager) {
  pluginManager.addRendererType(() => {
    return new RendererType({
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
