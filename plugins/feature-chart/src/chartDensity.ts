/**
 * The "too many charts in this view" rule, shared by both renderers.
 *
 * It used to be copy-pasted into `renderFeatureChart.ts` (canvas, in the RPC
 * worker) and `FeatureChartPlotlyRendering.tsx` (Plotly, on the main thread).
 * Two implementations of a degradation threshold is how a user sees a yellow
 * "too many charts" panel in one renderer and overlapping charts in the other
 * for the same view.
 *
 * The rule itself is unchanged (WP0 semantics, kept as the default in WP4):
 *
 * 1. more charts than `maxChartsPerView` → warn, and
 * 2. charts closer than `minChartSpacingPx` to their neighbour → warn.
 *
 * Both thresholds are **hard stops**: the renderer paints the warning panel
 * instead of the charts, so "one chart per 120px" never turns into an
 * unreadable pile. `FeatureChartRenderer.maxChartsPerView` /
 * `minChartSpacingPx` document the meaning; `docs/` explains why the default
 * is 100/4.
 */

export interface ChartPosition {
  /** Left edge of the chart, in display pixels. */
  x: number
}

export interface ChartDensityOptions {
  chartWidth: number
  maxChartsPerView: number
  minChartSpacingPx: number
}

/**
 * `true` when the view holds too many charts, or charts too close together, to
 * be drawn individually.
 */
export function shouldShowChartWarning(
  items: readonly ChartPosition[],
  { chartWidth, maxChartsPerView, minChartSpacingPx }: ChartDensityOptions,
): boolean {
  if (items.length === 0) {
    return false
  }
  if (items.length > maxChartsPerView) {
    return true
  }
  if (items.length <= 1) {
    return false
  }

  const sorted = [...items].sort((a, b) => a.x - b.x)
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!
    const curr = sorted[i]!
    if (curr.x - (prev.x + chartWidth) < minChartSpacingPx) {
      return true
    }
  }
  return false
}

/**
 * Wording of the degradation panel. One constant so the canvas painter, the
 * Plotly renderer and the docs cannot drift apart. It says what to do, not just
 * what is wrong: the charts are not drawn *because* the view is too wide.
 */
export const TOO_MANY_CHARTS_MESSAGE =
  'Too many charts — zoom in to view individual charts'
