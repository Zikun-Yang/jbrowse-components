import {
  type ChartModelAxisInfo,
  chartModelAxes,
  chartModelBins,
  chartModelCategories,
} from '../FeatureChartDrawer/painters.ts'

import type { ChartModel } from '../FeatureChartDrawer/chartModel.ts'
import type { FeatureChartColorScheme } from '../FeatureChartDrawer/colorSchemes.ts'
import type {
  Data as PlotlyData,
  Layout as PlotlyLayout,
} from 'plotly.js-dist-min'

/**
 * `ChartModel` → Plotly traces.
 *
 * Before WP4 the Plotly renderer had its own world: `plotType` plus shape
 * sniffing on the raw payload, so switching `drawer` changed the canvas track
 * and left the Plotly track alone. Now every trace is derived from the same
 * normalized model the canvas painters consume, using the same read-side
 * helpers (`chartModelCategories`, `chartModelBins`, `chartModelAxes`), which is
 * what makes "same categories, same values, same colors" checkable instead of
 * aspirational.
 *
 * Two deliberate choices:
 *
 * - **Histogram bins come from `computeBins()`**, not from Plotly's
 *   `nbinsx`. Two binning algorithms for one config is the exact class of bug
 *   this work package removes.
 * - **Precomputed quartiles become a `box` trace with `q1/median/q3/lowerfence/
 *   upperfence`**, so a `summary-stats` model draws a box without inventing
 *   observations it never had.
 */

/** Alpha suffix for the translucent fills the canvas painters use. */
const FILL_ALPHA = '33'

export function paletteColor(
  colorScheme: FeatureChartColorScheme,
  index: number,
): string {
  return colorScheme.colors[index % colorScheme.colors.length]!
}

export function chartModelTraces(
  model: ChartModel,
  colorScheme: FeatureChartColorScheme,
): PlotlyData[] {
  switch (model.kind) {
    case 'box':
      return chartModelCategories(model).map((entry, index) => {
        const color = entry.color ?? paletteColor(colorScheme, index)
        const shared = {
          type: 'box' as const,
          name: entry.name,
          boxpoints: false as const,
          fillcolor: `${color}${FILL_ALPHA}`,
          line: { color, width: 1.5 },
          marker: { color, size: 0 },
          whiskerwidth: 0.5,
        }
        if (entry.stats) {
          return {
            ...shared,
            // Plotly needs a `y` for the outliers/whiskers extent even when the
            // quartiles are precomputed; min/max is exactly that extent.
            y: [entry.stats.min, entry.stats.max],
            q1: entry.stats.q1,
            median: entry.stats.median,
            q3: entry.stats.q3,
            lowerfence: entry.stats.min,
            upperfence: entry.stats.max,
          }
        }
        return { ...shared, y: entry.values }
      })

    case 'violin':
      return chartModelCategories(model).map((entry, index) => ({
        type: 'violin',
        name: entry.name,
        y: entry.values,
        points: false,
        // The canvas violin is a KDE outline with a median tick: no box, no
        // mean line, no rug. Say so explicitly instead of relying on defaults.
        box: { visible: false },
        meanline: { visible: false },
        fillcolor: `${paletteColor(colorScheme, index)}${FILL_ALPHA}`,
        line: { color: paletteColor(colorScheme, index), width: 1.5 },
      }))

    case 'bar': {
      const entries = chartModelCategories(model)
      if (entries.length === 0) {
        return []
      }
      const colors = entries.map(
        (entry, index) => entry.color ?? paletteColor(colorScheme, index),
      )
      return [
        {
          type: 'bar',
          x: entries.map(entry => entry.name),
          y: entries.map(entry => entry.value ?? 0),
          marker: {
            color: colors.map(color => `${color}${FILL_ALPHA}`),
            line: { color: colors, width: 1.5 },
          },
        },
      ]
    }

    case 'histogram': {
      const bins = chartModelBins(model)
      if (!bins) {
        return []
      }
      const color = paletteColor(colorScheme, 0)
      const centers = bins.counts.map(
        (_, index) => (bins.edges[index]! + bins.edges[index + 1]!) / 2,
      )
      const widths = bins.counts.map(
        (_, index) => bins.edges[index + 1]! - bins.edges[index]!,
      )
      return [
        {
          type: 'bar',
          x: centers,
          y: bins.counts,
          width: widths,
          marker: {
            color: `${color}${FILL_ALPHA}`,
            line: { color, width: 1.5 },
          },
        },
      ]
    }
  }
}

/**
 * Layout for one chart, pinned to the canvas' axis window.
 *
 * `range` and `tickvals` come from `chartModelAxes()` (the numbers the painters
 * derive), so the interactive chart shows the same window and the same grid as
 * the track — Plotly's auto-ranges would otherwise pick its own `nice` numbers.
 */
export function chartModelLayout({
  model,
  colorScheme,
  width,
  height,
  fontSize,
  interactive = false,
  yLabel,
}: {
  model: ChartModel
  colorScheme: FeatureChartColorScheme
  width: number
  height: number
  fontSize: number
  /** Bigger margins/type when the plot fills a dialog. */
  interactive?: boolean
  /** Label shown on the y axis; the canvas derives it from `axes.yLabel`. */
  yLabel?: string
}): PlotlyLayout {
  const axes = chartModelAxes(model)
  return {
    width,
    height,
    margin: interactive
      ? { l: 56, r: 16, t: 24, b: 48 }
      : { l: 30, r: 10, t: 20, b: 30 },
    showlegend: false,
    colorway: colorScheme.colors,
    bargap: 0,
    font: { size: fontSize, color: colorScheme.text },
    paper_bgcolor: colorScheme.background,
    plot_bgcolor: colorScheme.background,
    ...(axes.yDomain ? {} : {}),
    xaxis: xAxisLayout(model, axes, colorScheme, fontSize),
    yaxis: yAxisLayout(
      axes,
      colorScheme,
      fontSize,
      yLabel ?? model.axes.yLabel,
    ),
  }
}

function yAxisLayout(
  axes: ChartModelAxisInfo,
  colorScheme: FeatureChartColorScheme,
  fontSize: number,
  yLabel: string | undefined,
) {
  return {
    ...(axes.yDomain ? { range: axes.yDomain } : {}),
    ...(axes.yTicks.length > 0 ? { tickvals: axes.yTicks } : {}),
    tickfont: { size: fontSize },
    automargin: true,
    gridcolor: colorScheme.grid,
    linecolor: colorScheme.axis,
    zerolinecolor: colorScheme.grid,
    ...(yLabel ? { title: { text: yLabel, font: { size: fontSize } } } : {}),
  }
}

function xAxisLayout(
  model: ChartModel,
  axes: ChartModelAxisInfo,
  colorScheme: FeatureChartColorScheme,
  fontSize: number,
) {
  const categories = chartModelCategories(model).map(entry => entry.name)
  if (model.kind === 'histogram') {
    return {
      ...(axes.xDomain ? { range: axes.xDomain } : {}),
      ...(axes.xTicks.length > 0 ? { tickvals: axes.xTicks } : {}),
      tickfont: { size: fontSize },
      automargin: true,
      gridcolor: colorScheme.grid,
      linecolor: colorScheme.axis,
      zerolinecolor: colorScheme.grid,
    }
  }
  return {
    type: 'category' as const,
    // Pin the order: the model's category order is the canvas draw order, and
    // Plotly would otherwise sort alphabetically.
    categoryorder: 'array' as const,
    categoryarray: categories,
    tickfont: { size: fontSize },
    automargin: true,
    gridcolor: colorScheme.grid,
    linecolor: colorScheme.axis,
    zerolinecolor: colorScheme.grid,
  }
}
