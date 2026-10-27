import type { FeatureChartColorScheme } from '../FeatureChartDrawer/colorSchemes.ts'
import type { Data as PlotlyData } from 'plotly.js-dist-min'

/**
 * The *only* Plotly rendering that does not go through a `ChartModel`:
 * `plotType: "scatter"` / `"line"` on a legacy config.
 *
 * Those two were never part of the v1 spec vocabulary, because no canvas
 * painter exists for them — a `FeatureChartRenderer` track could never draw
 * one, which is exactly the "two backends, two charts" inconsistency WP4
 * removes. Ripping them out immediately would break existing configs, so they
 * keep the pre-WP4 behaviour behind a deprecation warning and are scheduled for
 * removal in v2, when (and if) a scatter painter lands (`SPEC.md` §9).
 *
 * Everything this file does is the old `buildTraces()` reduced to the two kinds
 * that still need it. Do not extend it.
 */

type TraceWithColor = PlotlyData & {
  marker?: { color?: unknown }
  line?: { color?: unknown }
}

function colorAt(colorScheme: FeatureChartColorScheme, index: number) {
  return colorScheme.colors[index % colorScheme.colors.length]!
}

/**
 * `scatter` / `line` traces from the legacy payload shapes:
 * an array of Plotly traces, or `{ x: number[], y: number[] }`.
 *
 * Returns `[]` for anything else — the caller shows the deprecation panel
 * rather than an empty plot with no explanation.
 */
export function legacyPlotTypeTraces(
  plotType: 'scatter' | 'line',
  data: unknown,
  name: string,
  colorScheme: FeatureChartColorScheme,
): PlotlyData[] {
  if (Array.isArray(data)) {
    return (data as TraceWithColor[]).map((trace, index) => ({
      ...trace,
      ...(trace.marker?.color || trace.line?.color
        ? {}
        : { marker: { color: colorAt(colorScheme, index) } }),
    }))
  }
  if (
    data &&
    typeof data === 'object' &&
    'x' in data &&
    'y' in data &&
    Array.isArray((data as { x: unknown }).x) &&
    Array.isArray((data as { y: unknown }).y)
  ) {
    const { x, y } = data as { x: number[]; y: number[] }
    const color = colorAt(colorScheme, 0)
    return [
      {
        type: 'scatter',
        mode: plotType === 'line' ? 'lines' : 'markers',
        x,
        y,
        name,
        marker: { color },
        line: { color },
      },
    ]
  }
  return []
}
