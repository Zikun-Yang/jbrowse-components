import FeatureRendererType from '@jbrowse/core/pluggableElementTypes/renderers/FeatureRendererType'

import { renderFeatureChart } from './renderFeatureChart.ts'

import type { RenderArgsDeserialized } from '@jbrowse/core/pluggableElementTypes/renderers/FeatureRendererType'

export default class FeatureChartRenderer extends FeatureRendererType {
  supportsSVG = true

  async render(renderProps: RenderArgsDeserialized) {
    return renderFeatureChart(
      renderProps as import('./renderFeatureChart.ts').ChartRenderArgs,
      this.pluginManager,
    )
  }
}
