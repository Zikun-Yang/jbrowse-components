import { formatChartSpecError } from '../FeatureChartDrawer/chartSpec.ts'
import { modelColorScheme } from '../FeatureChartDrawer/painters.ts'
import { chartModelForData } from '../chartModelSources.ts'
import { chartModelLayout, chartModelTraces } from './chartTraces.ts'
import { legacyPlotTypeTraces } from './legacyPlotTypeTraces.ts'
import { isLegacyOnlyPlotType, plotTypeToSpec } from './plotTypeCompat.ts'

import type { FeatureChartColorScheme } from '../FeatureChartDrawer/colorSchemes.ts'
import type { TrackChartSource } from '../chartModelSources.ts'
import type { ThemeOptions } from '@mui/material'
import type {
  Data as PlotlyData,
  Layout as PlotlyLayout,
} from 'plotly.js-dist-min'

/**
 * "What does this one chart look like as Plotly data?" — the single answer used
 * by both the in-track renderer and the maximize dialog's interactive view.
 *
 * Keeping this in one function is the point: before WP4 the dialog could only
 * show a canvas, and the in-track Plotly chart built its traces inline, so the
 * two could (and did) disagree. Now the dialog mounts the same traces + layout
 * the track does, just bigger.
 */
export interface ChartPresentation {
  traces: PlotlyData[]
  layout?: PlotlyLayout
  /** Why there is nothing to draw (rendered as a `ChartNotice`). */
  notice?: string
}

export interface ChartPresentationInput {
  source: TrackChartSource
  data: unknown
  name: string
  width: number
  height: number
  fontSize: number
  theme?: ThemeOptions
  themeColorScheme: FeatureChartColorScheme
  interactive?: boolean
  /**
   * Pre-WP4 compatibility: `drawer` left at its default means "Plotly decides
   * from `plotType`" (see `plotTypeCompat.ts`). False once a drawer is named.
   */
  useLegacyPlotType?: boolean
  plotType?: string
}

export function presentChart({
  source,
  data,
  name,
  width,
  height,
  fontSize,
  theme,
  themeColorScheme,
  interactive = false,
  useLegacyPlotType = false,
  plotType = 'box',
}: ChartPresentationInput): ChartPresentation {
  if (useLegacyPlotType) {
    return presentLegacyPlotType({
      data,
      name,
      width,
      height,
      fontSize,
      interactive,
      plotType,
      themeColorScheme,
    })
  }

  if (source.canvasOnly) {
    return {
      traces: [],
      notice:
        'This drawer is canvas-only (it paints itself and provides no chart model). Use FeatureChartRenderer, or add buildModel to the drawer to render it here.',
    }
  }

  const { model, modelErrors } = chartModelForData(source, data)
  if (!model) {
    return {
      traces: [],
      notice: modelErrors?.[0]
        ? formatChartSpecError(modelErrors[0])
        : 'no chart model for this feature',
    }
  }

  const colorScheme = modelColorScheme(model, themeColorScheme, theme)
  return {
    traces: chartModelTraces(model, colorScheme),
    layout: chartModelLayout({
      model,
      colorScheme,
      width,
      height,
      fontSize,
      interactive,
    }),
  }
}

function presentLegacyPlotType({
  data,
  name,
  width,
  height,
  fontSize,
  interactive,
  plotType,
  themeColorScheme,
}: {
  data: unknown
  name: string
  width: number
  height: number
  fontSize: number
  interactive: boolean
  plotType: string
  themeColorScheme: FeatureChartColorScheme
}): ChartPresentation {
  if (isLegacyOnlyPlotType(plotType)) {
    const traces = legacyPlotTypeTraces(plotType, data, name, themeColorScheme)
    if (traces.length === 0) {
      return {
        traces: [],
        notice: `plotType "${plotType}" found no { x, y } series or Plotly traces in this feature's data. See FeatureChartTrack.md §7.`,
      }
    }
    return {
      traces,
      layout: legacyLayout(
        width,
        height,
        fontSize,
        interactive,
        themeColorScheme,
      ),
    }
  }

  const alias = plotTypeToSpec(plotType, data)
  if (alias.error || !alias.spec) {
    return {
      traces: [],
      notice: alias.error ?? `plotType "${plotType}" produced no chart`,
    }
  }
  const { model } = chartModelForData(
    { drawer: 'spec', spec: alias.spec, canvasOnly: false },
    alias.data,
  )
  if (!model) {
    return { traces: [], notice: `plotType "${plotType}" produced no chart` }
  }
  const colorScheme = modelColorScheme(model, themeColorScheme, undefined)
  return {
    traces: chartModelTraces(model, colorScheme),
    layout: chartModelLayout({
      model,
      colorScheme,
      width,
      height,
      fontSize,
      interactive,
    }),
  }
}

/** Minimal layout for the two legacy kinds, which have no model to borrow from. */
function legacyLayout(
  width: number,
  height: number,
  fontSize: number,
  interactive: boolean,
  colorScheme: FeatureChartColorScheme,
): PlotlyLayout {
  return {
    width,
    height,
    margin: interactive
      ? { l: 56, r: 16, t: 24, b: 48 }
      : { l: 30, r: 10, t: 20, b: 30 },
    showlegend: false,
    colorway: colorScheme.colors,
    font: { size: fontSize, color: colorScheme.text },
    paper_bgcolor: colorScheme.background,
    plot_bgcolor: colorScheme.background,
    xaxis: { gridcolor: colorScheme.grid, linecolor: colorScheme.axis },
    yaxis: { gridcolor: colorScheme.grid, linecolor: colorScheme.axis },
  }
}
