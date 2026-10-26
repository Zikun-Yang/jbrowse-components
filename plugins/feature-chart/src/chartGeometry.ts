import type { FeatureChartAlign } from './renderSettings.ts'
import type { Feature } from '@jbrowse/core/util'
import type { Region } from '@jbrowse/core/util/types'

/**
 * Geometry shared by the canvas renderer (which paints a chart at
 * `computeChartX()`), the hover hit test (`FeatureChartRendering`) and the
 * maximize affordance (`DisplayComponent`).
 *
 * A chart is a fixed-size widget anchored to the feature's start/end, so its
 * pixel rectangle is wider (often much wider) than the feature's bp span. Any
 * "is the pointer over this chart" question must therefore use the chart
 * rectangle, never the bp range: at a zoomed-out view the bp range is a couple
 * of pixels wide, while the chart is `chartWidth` pixels wide.
 */
export interface ChartGeometry {
  region: Region
  bpPerPx: number
  chartWidth: number
  align: FeatureChartAlign
}

export interface ChartRect {
  left: number
  right: number
  width: number
}

/** Left edge of the chart's pixel rectangle. Single source of truth. */
export function computeChartX(feature: Feature, geometry: ChartGeometry) {
  const { region, bpPerPx, chartWidth, align } = geometry
  const start = feature.get('start')
  const end = feature.get('end')

  switch (align) {
    case 'left':
      return (start - region.start) / bpPerPx
    case 'right':
      return (end - region.start) / bpPerPx - chartWidth
    case 'center': {
      const center = (start + end) / 2
      return (center - region.start) / bpPerPx - chartWidth / 2
    }
  }
}

export function computeChartRect(
  feature: Feature,
  geometry: ChartGeometry,
): ChartRect {
  const left = computeChartX(feature, geometry)
  return { left, right: left + geometry.chartWidth, width: geometry.chartWidth }
}

/**
 * The feature whose chart rectangle contains `px`, or `undefined` when the
 * pointer sits in the gap between charts. When charts overlap, the one whose
 * center is closest wins, so the hit test stays predictable.
 */
export function findFeatureAtChartX(
  features: Iterable<Feature>,
  geometry: ChartGeometry,
  px: number,
): Feature | undefined {
  let best: Feature | undefined
  let bestDistance = Infinity

  for (const feature of features) {
    const rect = computeChartRect(feature, geometry)
    if (px >= rect.left && px <= rect.right) {
      const distance = Math.abs(px - (rect.left + rect.width / 2))
      if (distance < bestDistance) {
        best = feature
        bestDistance = distance
      }
    }
  }
  return best
}

/**
 * Left offset for the maximize icon: inside the chart's own top-right corner,
 * so moving the pointer from the chart centre to the icon never leaves the
 * chart (which would clear the hovered feature and make the icon disappear
 * before it can be clicked), clamped to stay reachable inside the display.
 */
export function computeChartIconLeft({
  chartLeft,
  chartWidth,
  iconSize,
  displayWidth,
}: {
  chartLeft: number
  chartWidth: number
  iconSize: number
  displayWidth: number
}) {
  const desired = chartLeft + chartWidth - iconSize - 2
  const max = Math.max(0, displayWidth - iconSize - 2)
  return Math.max(0, Math.min(desired, max))
}
