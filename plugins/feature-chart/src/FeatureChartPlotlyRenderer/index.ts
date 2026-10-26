import { lazy } from 'react'

import FeatureChartPlotlyRenderer from './FeatureChartPlotlyRenderer.ts'
import configSchema from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function FeatureChartPlotlyRendererF(
  pluginManager: PluginManager,
) {
  pluginManager.addRendererType(() => {
    return new FeatureChartPlotlyRenderer({
      name: 'FeatureChartPlotlyRenderer',
      displayName: 'Feature chart Plotly renderer',
      configSchema,
      ReactComponent: lazy(
        () => import('./components/FeatureChartPlotlyRendering.tsx'),
      ),
      pluginManager,
    })
  })
}
