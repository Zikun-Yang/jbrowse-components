import { DEFAULT_CHART_BINS } from './chartSpec.ts'
import { resolveColorScheme } from './colorSchemes.ts'
import { scaleBand, scaleLinear } from './scales.ts'
import { computeKde, median, silvermanBandwidth, summarize } from './statistics.ts'

import type { ChartModel } from './chartModel.ts'
import type { FeatureChartColorScheme } from './colorSchemes.ts'
import type { SummaryStats } from './statistics.ts'
import type { DrawerProps } from './types.ts'

/**
 * The painters: one function per `ChartModel.kind`, all driven by the same
 * model. Every built-in drawer (legacy) and the `spec` drawer end up here, which
 * is what makes "legacy drawer == equivalent spec" true by construction rather
 * than by two implementations that happen to agree.
 *
 * Drawing order is load-bearing: this code used to be five near-copies, and the
 * existing jest suites count paint calls. Keep the sequence background → grid →
 * axes → ticks → marks, and draw nothing at all for an empty model.
 */

const Y_LABEL_MARGIN = 14

interface Layout {
  left: number
  top: number
  right: number
  bottom: number
  innerWidth: number
  innerHeight: number
}

/**
 * Paddings are proportional to the chart box, exactly as before WP3. The only
 * change is the extra left margin `axes.yLabel` needs; with no label this
 * returns the historical numbers bit for bit.
 */
function computeLayout(
  width: number,
  height: number,
  hasYLabel: boolean,
): Layout | undefined {
  const padding = {
    top: height * 0.12,
    right: width * 0.08,
    bottom: height * 0.22,
    left: width * 0.14 + (hasYLabel ? Y_LABEL_MARGIN : 0),
  }
  const innerWidth = Math.max(0, width - padding.left - padding.right)
  const innerHeight = Math.max(0, height - padding.top - padding.bottom)
  if (innerWidth <= 0 || innerHeight <= 0) {
    return undefined
  }
  return {
    left: padding.left,
    top: padding.top,
    right: padding.right,
    bottom: padding.bottom,
    innerWidth,
    innerHeight,
  }
}

/** Panel background, grid lines, y axis, y ticks and the optional y label. */
function drawFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  layout: Layout,
  yScale: ReturnType<typeof scaleLinear>,
  colorScheme: FeatureChartColorScheme,
  yLabel: string | undefined,
  formatY: (value: number) => string = formatTick,
) {
  const { innerWidth, innerHeight, left, top } = layout

  // Background panel (ggplot style)
  ctx.fillStyle = colorScheme.background
  ctx.fillRect(0, 0, width, height)

  ctx.save()
  ctx.translate(left, top)

  // Grid lines
  ctx.strokeStyle = colorScheme.grid
  ctx.lineWidth = 1
  for (const tick of yScale.ticks(5)) {
    const y = yScale(tick)
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(innerWidth, y)
    ctx.stroke()
  }

  // Y axis
  ctx.strokeStyle = colorScheme.axis
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(0, innerHeight)
  ctx.lineTo(innerWidth, innerHeight)
  ctx.stroke()

  // Y ticks and labels
  ctx.fillStyle = colorScheme.text
  ctx.font = `${Math.max(8, Math.min(12, height * 0.05))}px sans-serif`
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  for (const tick of yScale.ticks(5)) {
    const y = yScale(tick)
    ctx.beginPath()
    ctx.moveTo(-4, y)
    ctx.lineTo(0, y)
    ctx.stroke()
    ctx.fillText(formatY(tick), -8, y)
  }

  if (yLabel) {
    ctx.save()
    // Rotated label in the margin the caller reserved for it.
    ctx.translate(-(left - 6), innerHeight / 2)
    ctx.rotate(-Math.PI / 2)
    ctx.font = `${Math.max(8, Math.min(11, height * 0.055))}px sans-serif`
    ctx.fillStyle = colorScheme.text
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(truncateLabel(yLabel, innerHeight), 0, 0)
    ctx.restore()
  }
}

function drawCategoryLabels(
  ctx: CanvasRenderingContext2D,
  categories: string[],
  xScale: ReturnType<typeof scaleBand>,
  innerHeight: number,
  colorScheme: FeatureChartColorScheme,
) {
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillStyle = colorScheme.text
  for (const category of categories) {
    const x = (xScale(category) ?? 0) + xScale.bandwidth() / 2
    ctx.fillText(
      truncateLabel(category, xScale.bandwidth()),
      x,
      innerHeight + 6,
    )
  }
}

function statsFor(datum: ChartModel['series'][number]['data'][number]) {
  switch (datum.form) {
    case 'summary-stats':
      return { stats: datum.stats, color: datum.color }
    case 'grouped-values':
      return { stats: summarize(datum.values), color: undefined }
    default:
      return { stats: undefined, color: undefined }
  }
}

function boxDomain(stats: SummaryStats[]): [number, number] | undefined {
  if (stats.length === 0) {
    return undefined
  }
  let min = Infinity
  let max = -Infinity
  for (const s of stats) {
    if (s.min < min) {
      min = s.min
    }
    if (s.max > max) {
      max = s.max
    }
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return undefined
  }
  const padding = (max - min) * 0.05 || 1
  return [min - padding, max + padding]
}

function paintBox(
  props: DrawerProps,
  model: ChartModel,
  colorScheme: FeatureChartColorScheme,
) {
  const { ctx, width, height } = props
  const layout = computeLayout(width, height, model.axes.yLabel !== undefined)
  if (!layout) {
    return
  }

  const categories: string[] = []
  const stats: SummaryStats[] = []
  const colors: (string | undefined)[] = []
  const series = model.series[0]
  for (const [index, datum] of (series?.data ?? []).entries()) {
    const resolved = statsFor(datum)
    if (!resolved.stats) {
      continue
    }
    categories.push(model.categories[index] ?? resolved.stats.median.toString())
    stats.push(resolved.stats)
    colors.push(resolved.color)
  }
  if (stats.length === 0) {
    return
  }

  const yDomain = boxDomain(stats)
  if (!yDomain) {
    return
  }

  const xScale = scaleBand()
    .domain(categories)
    .range([0, layout.innerWidth])
    .padding(0.3)
  const yScale = scaleLinear().domain(yDomain).range([layout.innerHeight, 0]).nice()

  drawFrame(
    ctx,
    width,
    height,
    layout,
    yScale,
    colorScheme,
    model.axes.yLabel,
  )

  // X labels and boxes
  drawCategoryLabels(
    ctx,
    categories,
    xScale,
    layout.innerHeight,
    colorScheme,
  )
  for (const [i, name] of categories.entries()) {
    const s = stats[i]!
    const color = colors[i] ?? colorScheme.colors[i % colorScheme.colors.length]!

    const boxX = xScale(name) ?? 0
    const boxW = xScale.bandwidth()
    const yQ1 = yScale(s.q1)
    const yQ3 = yScale(s.q3)
    const yMedian = yScale(s.median)
    const yMin = yScale(s.min)
    const yMax = yScale(s.max)

    // Whiskers
    ctx.strokeStyle = colorScheme.muted
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(boxX + boxW / 2, yMin)
    ctx.lineTo(boxX + boxW / 2, yMax)
    ctx.stroke()

    // Whisker caps
    ctx.beginPath()
    ctx.moveTo(boxX + boxW * 0.25, yMin)
    ctx.lineTo(boxX + boxW * 0.75, yMin)
    ctx.moveTo(boxX + boxW * 0.25, yMax)
    ctx.lineTo(boxX + boxW * 0.75, yMax)
    ctx.stroke()

    // Box
    ctx.fillStyle = `${color}33` // 20% opacity
    ctx.strokeStyle = color
    ctx.lineWidth = 1.5
    const boxY = Math.min(yQ1, yQ3)
    const boxH = Math.abs(yQ3 - yQ1)
    ctx.fillRect(boxX, boxY, boxW, boxH)
    ctx.strokeRect(boxX, boxY, boxW, boxH)

    // Median
    ctx.strokeStyle = colorScheme.axis
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(boxX, yMedian)
    ctx.lineTo(boxX + boxW, yMedian)
    ctx.stroke()
  }

  ctx.restore()
}

function paintBar(
  props: DrawerProps,
  model: ChartModel,
  colorScheme: FeatureChartColorScheme,
) {
  const { ctx, width, height } = props
  const layout = computeLayout(width, height, model.axes.yLabel !== undefined)
  if (!layout) {
    return
  }

  const categories: string[] = []
  const values: number[] = []
  const colors: (string | undefined)[] = []
  for (const [index, datum] of (model.series[0]?.data ?? []).entries()) {
    if (datum.form !== 'category-values') {
      continue
    }
    categories.push(model.categories[index] ?? datum.value.toString())
    values.push(datum.value)
    colors.push(datum.color)
  }
  if (values.length === 0) {
    return
  }

  let min = 0
  let max = -Infinity
  for (const value of values) {
    if (value < min) {
      min = value
    }
    if (value > max) {
      max = value
    }
  }
  if (!Number.isFinite(max)) {
    return
  }
  const padding = (max - min) * 0.05 || 1
  const yScale = scaleLinear()
    .domain([min - padding, max + padding])
    .range([layout.innerHeight, 0])
    .nice()

  const xScale = scaleBand()
    .domain(categories)
    .range([0, layout.innerWidth])
    .padding(0.3)
  const baselineY = yScale(0)

  drawFrame(
    ctx,
    width,
    height,
    layout,
    yScale,
    colorScheme,
    model.axes.yLabel,
  )

  // X labels and bars
  drawCategoryLabels(
    ctx,
    categories,
    xScale,
    layout.innerHeight,
    colorScheme,
  )
  for (const [i, name] of categories.entries()) {
    const color = colors[i] ?? colorScheme.colors[i % colorScheme.colors.length]!
    const barX = xScale(name) ?? 0
    const barW = xScale.bandwidth()
    const barY = yScale(values[i]!)
    const barH = baselineY - barY

    ctx.fillStyle = `${color}33` // 20% opacity
    ctx.strokeStyle = color
    ctx.lineWidth = 1.5
    ctx.fillRect(barX, Math.min(barY, baselineY), barW, Math.abs(barH))
    ctx.strokeRect(barX, Math.min(barY, baselineY), barW, Math.abs(barH))
  }

  ctx.restore()
}

function paintViolin(
  props: DrawerProps,
  model: ChartModel,
  colorScheme: FeatureChartColorScheme,
) {
  const { ctx, width, height } = props
  const layout = computeLayout(width, height, model.axes.yLabel !== undefined)
  if (!layout) {
    return
  }

  const categories: string[] = []
  const groups: number[][] = []
  for (const [index, datum] of (model.series[0]?.data ?? []).entries()) {
    if (datum.form !== 'grouped-values' || datum.values.length === 0) {
      continue
    }
    categories.push(model.categories[index] ?? String(index))
    groups.push(datum.values)
  }
  if (groups.length === 0) {
    return
  }

  let min = Infinity
  let max = -Infinity
  for (const values of groups) {
    for (const value of values) {
      if (value < min) {
        min = value
      }
      if (value > max) {
        max = value
      }
    }
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return
  }
  const padding = (max - min) * 0.05 || 1
  const yDomain: [number, number] = [min - padding, max + padding]

  const xScale = scaleBand()
    .domain(categories)
    .range([0, layout.innerWidth])
    .padding(0.3)
  const yScale = scaleLinear().domain(yDomain).range([layout.innerHeight, 0]).nice()

  drawFrame(
    ctx,
    width,
    height,
    layout,
    yScale,
    colorScheme,
    model.axes.yLabel,
  )

  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  for (const [i, name] of categories.entries()) {
    const values = groups[i]!
    const centerX = (xScale(name) ?? 0) + xScale.bandwidth() / 2
    ctx.fillStyle = colorScheme.text
    ctx.fillText(
      truncateLabel(name, xScale.bandwidth()),
      centerX,
      layout.innerHeight + 6,
    )

    const color = colorScheme.colors[i % colorScheme.colors.length]!
    const bandwidth = silvermanBandwidth(values)
    const densities = computeKde(values, bandwidth, yDomain[0], yDomain[1])
    const maxDensity = Math.max(...densities.map(d => d.density))
    const maxHalfWidth = (xScale.bandwidth() / 2) * 0.9
    const widthScale = scaleLinear()
      .domain([0, maxDensity || 1])
      .range([0, maxHalfWidth])

    // Build violin path from top to bottom on the right side,
    // then back up on the left side.
    ctx.beginPath()
    for (let j = densities.length - 1; j >= 0; j--) {
      const { y, density } = densities[j]!
      const xOffset = widthScale(density)
      const px = centerX + xOffset
      const py = yScale(y)
      if (j === densities.length - 1) {
        ctx.moveTo(px, py)
      } else {
        ctx.lineTo(px, py)
      }
    }
    for (const { y, density } of densities) {
      const xOffset = widthScale(density)
      ctx.lineTo(centerX - xOffset, yScale(y))
    }
    ctx.closePath()

    ctx.fillStyle = `${color}33` // 20% opacity
    ctx.fill()
    ctx.strokeStyle = color
    ctx.lineWidth = 1.5
    ctx.stroke()

    // Median line
    const center = median(values)
    if (center === undefined) {
      continue
    }
    const medianY = yScale(center)
    ctx.strokeStyle = colorScheme.axis
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(centerX - maxHalfWidth * 0.2, medianY)
    ctx.lineTo(centerX + maxHalfWidth * 0.2, medianY)
    ctx.stroke()
  }

  ctx.restore()
}

function paintHistogram(
  props: DrawerProps,
  model: ChartModel,
  colorScheme: FeatureChartColorScheme,
) {
  const { ctx, width, height } = props
  const layout = computeLayout(width, height, model.axes.yLabel !== undefined)
  if (!layout) {
    return
  }

  const datum = model.series[0]?.data[0]
  const values = datum?.form === 'values' ? datum.values : []
  if (values.length === 0) {
    return
  }

  const rawBins = model.style.bins ?? DEFAULT_CHART_BINS
  const binCount = Math.max(1, Math.min(100, Math.round(rawBins)))
  const { edges, counts } = computeBins(values, binCount)
  const maxCount = Math.max(...counts)
  if (!Number.isFinite(maxCount) || maxCount <= 0) {
    return
  }

  const xMin = edges[0]!
  const xMax = edges[edges.length - 1]!
  const xScale = scaleLinear()
    .domain([xMin, xMax])
    .range([0, layout.innerWidth])
    .nice()
  const yScale = scaleLinear()
    .domain([0, maxCount])
    .range([layout.innerHeight, 0])
    .nice()

  drawFrame(
    ctx,
    width,
    height,
    layout,
    yScale,
    colorScheme,
    model.axes.yLabel,
    // The histogram has always labelled counts with plain strings, not the
    // decimal-trimmed tick format the other kinds use.
    String,
  )

  // X ticks and labels
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  for (const tick of xScale.ticks(5)) {
    const x = xScale(tick)
    ctx.beginPath()
    ctx.moveTo(x, layout.innerHeight)
    ctx.lineTo(x, layout.innerHeight + 4)
    ctx.stroke()
    ctx.fillText(formatTick(tick), x, layout.innerHeight + 6)
  }

  // Histogram bars
  const barColor = colorScheme.colors[0]!
  ctx.fillStyle = `${barColor}33` // 20% opacity
  ctx.strokeStyle = barColor
  ctx.lineWidth = 1.5
  for (const [i, count] of counts.entries()) {
    const x0 = xScale(edges[i]!)
    const x1 = xScale(edges[i + 1]!)
    const barX = Math.min(x0, x1)
    const barW = Math.abs(x1 - x0)
    const barH = layout.innerHeight - yScale(count)
    const barY = layout.innerHeight - barH

    if (barW <= 0 || barH <= 0) {
      continue
    }

    ctx.fillRect(barX, barY, barW, barH)
    ctx.strokeRect(barX, barY, barW, barH)
  }

  ctx.restore()
}

export function computeBins(
  values: number[],
  binCount: number,
): { edges: number[]; counts: number[] } {
  const min = Math.min(...values)
  const max = Math.max(...values)
  const step = (max - min) / binCount || 1
  const edges: number[] = []
  for (let i = 0; i <= binCount; i++) {
    edges.push(min + step * i)
  }

  const counts = Array.from({ length: binCount }, () => 0)
  for (const v of values) {
    let index = Math.floor(((v - min) / (max - min)) * binCount)
    if (index < 0) {
      index = 0
    }
    if (index >= binCount) {
      index = binCount - 1
    }
    counts[index]!++
  }

  return { edges, counts }
}

/** Palette for a model: `spec.style.colorScheme` wins over the renderer slot. */
export function resolveModelColorScheme(
  props: DrawerProps,
  model: ChartModel,
): FeatureChartColorScheme {
  return model.style.colorScheme
    ? resolveColorScheme(props.theme, model.style.colorScheme)
    : (props.colorScheme ?? resolveColorScheme(props.theme))
}

/**
 * Paint a normalized model. Empty models draw nothing at all: a chart with no
 * data is an empty chart, never an error (see `ARCHITECTURE.md`).
 */
export function paintChartModel(props: DrawerProps, model: ChartModel) {
  const colorScheme = resolveModelColorScheme(props, model)
  switch (model.kind) {
    case 'box':
      paintBox(props, model, colorScheme)
      return
    case 'violin':
      paintViolin(props, model, colorScheme)
      return
    case 'bar':
      paintBar(props, model, colorScheme)
      return
    case 'histogram':
      paintHistogram(props, model, colorScheme)
      return
  }
}

export function formatTick(value: number): string {
  if (Math.abs(value) >= 1000 || (Math.abs(value) < 0.01 && value !== 0)) {
    return value.toExponential(1)
  }
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

export function truncateLabel(label: string, maxWidth: number): string {
  const approxChars = Math.max(3, Math.floor(maxWidth / 6))
  if (label.length <= approxChars) {
    return label
  }
  return `${label.slice(0, approxChars - 1)}…`
}
