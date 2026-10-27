import { useEffect, useMemo, useRef } from 'react'
import type { ReactNode } from 'react'

import { observer } from 'mobx-react'

import ChartNotice from './ChartNotice.tsx'
import PlotlyPlot from './PlotlyPlot.tsx'
import { formatChartSpecError } from '../../FeatureChartDrawer/chartSpec.ts'
import { resolveColorScheme } from '../../FeatureChartDrawer/colorSchemes.ts'
import { formatFeatureChartDrawerError } from '../../FeatureChartDrawer/drawerErrors.ts'
import {
  TOO_MANY_CHARTS_MESSAGE,
  shouldShowChartWarning,
} from '../../chartDensity.ts'
import { computeChartX } from '../../chartGeometry.ts'
import {
  pluginManagerFor,
  resolveTrackChartSource,
} from '../../chartModelSources.ts'
import {
  FEATURE_CHART_RENDER_DEFAULTS,
  resolveFeatureChartRenderSettings,
} from '../../renderSettings.ts'
import { presentChart } from '../chartPresentation.ts'
import { warnPlotTypeDeprecated } from '../plotTypeCompat.ts'

import type { TrackChartSource } from '../../chartModelSources.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature, Region } from '@jbrowse/core/util'
import type { BaseLinearDisplayModel } from '@jbrowse/plugin-linear-genome-view'
import type { ThemeOptions } from '@mui/material'

/**
 * Plotly renderer — now a **backend**, not a second configuration language.
 *
 * Resolution order (documented in `FeatureChartTrack.md` §7):
 *
 * 1. `drawer: "spec"` → validate once, normalize per feature (the model).
 * 2. `drawer` explicitly set to a built-in or plugin drawer → that drawer's
 *    model (`buildModel` in `drawerRegistry.ts`), i.e. the same model the
 *    canvas track paints. A plugin drawer without a model builder is
 *    canvas-only and says so.
 * 3. `drawer` left at its default → the pre-WP4 behaviour (`plotType`), kept as
 *    a deprecated alias that compiles to a spec, with one warning.
 *
 * Before WP4 the drawer was ignored entirely here, which is why "change the
 * drawer" appeared to do nothing on a Plotly track.
 */

const FeatureChartPlotlyRendering = observer(
  function FeatureChartPlotlyRendering(props: {
    features: Map<string, Feature>
    regions: Region[]
    bpPerPx: number
    width: number
    height: number
    blockKey: string
    displayModel: BaseLinearDisplayModel
    config: AnyConfigurationModel
    theme?: ThemeOptions
  }) {
    const {
      features,
      regions,
      bpPerPx,
      width,
      height,
      displayModel,
      config,
      theme,
    } = props
    const region = regions[0]!
    const containerRef = useRef<HTMLDivElement>(null)

    // Geometry and colors come from this renderer's own config, not from
    // fields copied into the render props by the display.
    const settings = resolveFeatureChartRenderSettings(config)
    const {
      chartHeight,
      chartWidth,
      align,
      maxChartsPerView,
      minChartSpacingPx,
    } = settings
    const themeMode = theme?.palette?.mode
    const themeColorScheme = useMemo(
      () => resolveColorScheme(theme, settings.colorScheme),
      // The resolved scheme only depends on the palette name and theme mode.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [themeMode, settings.colorScheme],
    )
    const plotType =
      (config as unknown as { plotType?: string }).plotType ?? 'box'

    // `drawer` untouched (== schema default) is the pre-WP4 "Plotly picks the
    // chart" mode. Any explicit drawer, including `spec`, wins over `plotType`.
    const useLegacyPlotType =
      settings.drawer === FEATURE_CHART_RENDER_DEFAULTS.drawer

    const pluginManager = pluginManagerFor(displayModel)
    // In legacy mode the drawer is deliberately not consulted: `plotType` was
    // the only knob the pre-WP4 renderer read, so resolving (and possibly
    // failing on) a drawer it never used would be a new error path.
    const source: TrackChartSource = useMemo(
      () =>
        useLegacyPlotType
          ? { drawer: settings.drawer, canvasOnly: false }
          : resolveTrackChartSource({
              drawer: settings.drawer,
              spec: settings.spec,
              pluginManager,
            }),
      [useLegacyPlotType, settings.drawer, settings.spec, pluginManager],
    )

    useEffect(() => {
      if (useLegacyPlotType) {
        warnPlotTypeDeprecated(plotType, undefined)
      }
    }, [useLegacyPlotType, plotType])

    const chartItems = Array.from(features.values())
      .map(feature => ({
        feature,
        x: computeChartX(feature, { region, bpPerPx, chartWidth, align }),
      }))
      .sort((a, b) => a.x - b.x)

    const showWarning = shouldShowChartWarning(chartItems, {
      chartWidth,
      maxChartsPerView,
      minChartSpacingPx,
    })

    function getFeatureUnderMouse(eventClientX: number) {
      let offset = 0
      if (containerRef.current) {
        offset = containerRef.current.getBoundingClientRect().left
      }
      const offsetX = eventClientX - offset
      const px = region.reversed ? width - offsetX : offsetX
      const clientBp = region.start + bpPerPx * px

      let featureUnderMouse: Feature | undefined
      for (const { feature } of chartItems) {
        if (
          clientBp <= feature.get('end') &&
          clientBp >= feature.get('start')
        ) {
          featureUnderMouse = feature
          break
        }
      }
      return featureUnderMouse
    }

    let body: ReactNode
    if (source.drawerError) {
      body = (
        <ChartNotice
          testId="feature-chart-plotly-drawer-error"
          message={formatFeatureChartDrawerError(source.drawerError)}
        />
      )
    } else if (source.specErrors && source.specErrors.length > 0) {
      body = (
        <ChartNotice
          testId="feature-chart-plotly-spec-error"
          message={`Invalid chart spec: ${source.specErrors
            .map(error => formatChartSpecError(error))
            .join('; ')}`}
        />
      )
    } else if (showWarning) {
      body = (
        <ChartNotice
          testId="feature-chart-plotly-density-warning"
          message={TOO_MANY_CHARTS_MESSAGE}
        />
      )
    } else {
      body = chartItems.map(({ feature, x }) => (
        <Chart
          key={feature.id()}
          feature={feature}
          x={x}
          chartWidth={chartWidth}
          chartHeight={chartHeight}
          source={source}
          useLegacyPlotType={useLegacyPlotType}
          plotType={plotType}
          theme={theme}
          themeColorScheme={themeColorScheme}
        />
      ))
    }

    return (
      <div
        ref={containerRef}
        data-testid="feature-chart-plotly-rendering-test"
        onMouseMove={e => {
          displayModel.setFeatureIdUnderMouse(
            getFeatureUnderMouse(e.clientX)?.id(),
          )
        }}
        onMouseLeave={() => {
          displayModel.setFeatureIdUnderMouse(undefined)
        }}
        style={{ position: 'relative', height, width, overflow: 'hidden' }}
      >
        {body}
      </div>
    )
  },
)

/**
 * One chart: model → traces/layout, then `<PlotlyPlot>`.
 *
 * Everything that decides *what* is drawn happens before the Plotly call, in
 * `chartTraces.ts`/`chartModelLayout()`; this component only wires it up.
 */
function Chart({
  feature,
  x,
  chartWidth,
  chartHeight,
  source,
  useLegacyPlotType,
  plotType,
  theme,
  themeColorScheme,
}: {
  feature: Feature
  x: number
  chartWidth: number
  chartHeight: number
  source: TrackChartSource
  useLegacyPlotType: boolean
  plotType: string
  theme?: ThemeOptions
  themeColorScheme: ReturnType<typeof resolveColorScheme>
}) {
  const contextData = feature.get('contextData') as
    | { data?: unknown; description?: string; name?: string }
    | undefined
  const data = contextData?.data
  const name =
    contextData?.name ??
    (feature.get('name') as string | undefined) ??
    feature.id()

  // One function decides traces + layout, for this renderer and the maximize
  // dialog alike (`chartPresentation.ts`).
  const presentation = useMemo(
    () =>
      presentChart({
        source,
        data,
        name,
        width: chartWidth,
        height: chartHeight,
        fontSize: 8,
        theme,
        themeColorScheme,
        useLegacyPlotType,
        plotType,
      }),
    // `data` is the only per-chart input; the source is stable per render.

    [
      useLegacyPlotType,
      plotType,
      data,
      source,
      chartWidth,
      chartHeight,
      theme,
      themeColorScheme,
      name,
    ],
  )

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: 0,
        width: chartWidth,
        height: chartHeight,
      }}
    >
      {presentation.notice !== undefined ? (
        <ChartNotice message={presentation.notice} />
      ) : presentation.layout ? (
        <PlotlyPlot traces={presentation.traces} layout={presentation.layout} />
      ) : null}
    </div>
  )
}

export default FeatureChartPlotlyRendering
