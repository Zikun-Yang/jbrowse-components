import { getSession } from '@jbrowse/core/util'

import { resolveColorScheme } from '../../FeatureChartDrawer/colorSchemes.ts'
import { presentChart } from '../../FeatureChartPlotlyRenderer/chartPresentation.ts'
import ChartNotice from '../../FeatureChartPlotlyRenderer/components/ChartNotice.tsx'
import PlotlyPlot from '../../FeatureChartPlotlyRenderer/components/PlotlyPlot.tsx'
import {
  pluginManagerFor,
  resolveTrackChartSource,
} from '../../chartModelSources.ts'
import {
  FEATURE_CHART_RENDER_DEFAULTS,
  resolveFeatureChartRenderSettings,
} from '../../renderSettings.ts'

import type { PlotlyExportHandle } from '../../FeatureChartPlotlyRenderer/plotlyLoader.ts'
import type { TrackChartSource } from '../../chartModelSources.ts'
import type { LinearFeatureChartDisplayModel } from '../model.ts'
import type { Feature } from '@jbrowse/core/util'

/**
 * The interactive half of the maximize dialog: the same model, traces and axis
 * window as the in-track Plotly chart, at dialog size, plus the export handle.
 */
export default function MaximizePlotly({
  feature,
  displayModel,
  width,
  height,
  onPlotReady,
}: {
  feature: Feature
  displayModel: LinearFeatureChartDisplayModel
  width: number
  height: number
  onPlotReady?: (handle: PlotlyExportHandle | null) => void
}) {
  const contextData = feature.get('contextData') as
    | { data?: unknown; description?: string; name?: string }
    | undefined
  const settings = resolveFeatureChartRenderSettings(
    displayModel.rendererConfig,
  )
  const pluginManager = pluginManagerFor(displayModel)
  const theme = getSession(displayModel).theme
  const themeColorScheme = resolveColorScheme(theme, settings.colorScheme)

  const useLegacyPlotType =
    settings.drawer === FEATURE_CHART_RENDER_DEFAULTS.drawer
  // Resolve the drawer even in legacy mode: `presentChart` gives the drawer's
  // model the first chance and only falls back to `plotType` when the payload
  // has no model (see `chartPresentation.ts`). Without this, a track that omits
  // `drawer` drew fine in the track and claimed "plotType does not recognize
  // this payload" here.
  const source: TrackChartSource = resolveTrackChartSource({
    drawer: settings.drawer,
    spec: settings.spec,
    pluginManager,
  })
  // One chart: no memo needed, and no disabled React rules for the compiler.
  const presentation = presentChart({
    source,
    data: contextData?.data,
    name:
      contextData?.name ??
      (feature.get('name') as string | undefined) ??
      feature.id(),
    width,
    height,
    fontSize: 11,
    theme,
    themeColorScheme,
    interactive: true,
    useLegacyPlotType,
    plotType: (displayModel.rendererConfig as unknown as { plotType?: string })
      .plotType,
  })

  if (presentation.notice !== undefined) {
    return (
      <ChartNotice
        testId="feature-chart-maximize-plotly-notice"
        message={presentation.notice}
      />
    )
  }
  if (!presentation.layout) {
    return null
  }
  return (
    <PlotlyPlot
      traces={presentation.traces}
      layout={presentation.layout}
      onPlotReady={onPlotReady}
      testId="feature-chart-maximize-plotly"
    />
  )
}
