import { scaleBand, scaleLinear } from 'd3-scale'

import type { DrawerFunction } from './types.ts'

interface BoxStats {
  name: string
  min: number
  q1: number
  median: number
  q3: number
  max: number
  color?: string
}

interface PrecomputedBoxPlotData {
  boxes?: BoxStats[]
}

interface RawTissueData {
  tissues?: Record<string, number[]>
}

const DEFAULT_COLORS = [
  '#4e79a7',
  '#f28e2c',
  '#e15759',
  '#76b7b2',
  '#59a14f',
  '#edc949',
  '#af7aa1',
  '#ff9da7',
  '#9c755f',
  '#bab0ab',
]

function quantile(sorted: number[], p: number): number {
  const index = (sorted.length - 1) * p
  const lower = Math.floor(index)
  const upper = Math.ceil(index)
  const weight = index - lower
  return sorted[lower]! * (1 - weight) + sorted[upper]! * weight
}

function computeStats(
  values: number[],
): Omit<BoxStats, 'name' | 'color'> | undefined {
  if (values.length === 0) return undefined
  const sorted = [...values].sort((a, b) => a - b)
  const q1 = quantile(sorted, 0.25)
  const median = quantile(sorted, 0.5)
  const q3 = quantile(sorted, 0.75)
  const iqr = q3 - q1
  const min = Math.max(sorted[0]!, q1 - 1.5 * iqr)
  const max = Math.min(sorted[sorted.length - 1]!, q3 + 1.5 * iqr)
  return { min, q1, median, q3, max }
}

function normalizeBoxStats(data: PrecomputedBoxPlotData): BoxStats[] {
  if (!Array.isArray(data.boxes) || data.boxes.length === 0) {
    return []
  }

  return data.boxes
    .map((box): BoxStats | undefined => {
      const { name, min, q1, median, q3, max, color } = box
      if (
        typeof name !== 'string' ||
        !Number.isFinite(min) ||
        !Number.isFinite(q1) ||
        !Number.isFinite(median) ||
        !Number.isFinite(q3) ||
        !Number.isFinite(max)
      ) {
        return undefined
      }
      return { name, min, q1, median, q3, max, ...(color ? { color } : {}) }
    })
    .filter((b): b is BoxStats => b !== undefined)
}

function normalizeTissueStats(data: RawTissueData): BoxStats[] {
  const tissues = data.tissues
  if (!tissues || Object.keys(tissues).length === 0) {
    return []
  }

  return Object.entries(tissues)
    .map(([name, values]) => {
      const s = computeStats(values)
      return s ? { ...s, name } : undefined
    })
    .filter((s): s is BoxStats => s !== undefined)
}

function computeYDomain(stats: BoxStats[]): [number, number] | undefined {
  if (stats.length === 0) return undefined
  let min = Infinity
  let max = -Infinity
  for (const s of stats) {
    if (s.min < min) min = s.min
    if (s.max > max) max = s.max
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return undefined
  const padding = (max - min) * 0.05 || 1
  return [min - padding, max + padding]
}

function drawBoxStats(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  stats: BoxStats[],
) {
  const yDomain = computeYDomain(stats)
  if (!yDomain) {
    return
  }

  const padding = {
    top: height * 0.12,
    right: width * 0.08,
    bottom: height * 0.22,
    left: width * 0.14,
  }

  const innerWidth = Math.max(0, width - padding.left - padding.right)
  const innerHeight = Math.max(0, height - padding.top - padding.bottom)

  if (innerWidth <= 0 || innerHeight <= 0) {
    return
  }

  const xScale = scaleBand<string>()
    .domain(stats.map(d => d.name))
    .range([0, innerWidth])
    .padding(0.3)

  const yScale = scaleLinear().domain(yDomain).range([innerHeight, 0]).nice()

  // Background panel (ggplot style)
  ctx.fillStyle = '#fafafa'
  ctx.fillRect(0, 0, width, height)

  ctx.save()
  ctx.translate(padding.left, padding.top)

  // Grid lines
  ctx.strokeStyle = '#e0e0e0'
  ctx.lineWidth = 1
  yScale.ticks(5).forEach(tick => {
    const y = yScale(tick)
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(innerWidth, y)
    ctx.stroke()
  })

  // Y axis
  ctx.strokeStyle = '#333333'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(0, innerHeight)
  ctx.lineTo(innerWidth, innerHeight)
  ctx.stroke()

  // Y ticks and labels
  ctx.fillStyle = '#333333'
  ctx.font = `${Math.max(8, Math.min(12, height * 0.05))}px sans-serif`
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  yScale.ticks(5).forEach(tick => {
    const y = yScale(tick)
    ctx.beginPath()
    ctx.moveTo(-4, y)
    ctx.lineTo(0, y)
    ctx.stroke()
    ctx.fillText(formatTick(tick), -8, y)
  })

  // X labels and boxes
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  stats.forEach((d, i) => {
    const x = (xScale(d.name) ?? 0) + xScale.bandwidth() / 2
    const label = truncateLabel(d.name, xScale.bandwidth())
    ctx.fillStyle = '#333333'
    ctx.fillText(label, x, innerHeight + 6)

    // Color
    const color = d.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length]!

    const boxX = xScale(d.name) ?? 0
    const boxW = xScale.bandwidth()
    const yQ1 = yScale(d.q1)
    const yQ3 = yScale(d.q3)
    const yMedian = yScale(d.median)
    const yMin = yScale(d.min)
    const yMax = yScale(d.max)

    // Whiskers
    ctx.strokeStyle = '#555555'
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
    ctx.fillStyle = color + '33' // 20% opacity
    ctx.strokeStyle = color
    ctx.lineWidth = 1.5
    const boxY = Math.min(yQ1, yQ3)
    const boxH = Math.abs(yQ3 - yQ1)
    ctx.fillRect(boxX, boxY, boxW, boxH)
    ctx.strokeRect(boxX, boxY, boxW, boxH)

    // Median
    ctx.strokeStyle = '#333333'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(boxX, yMedian)
    ctx.lineTo(boxX + boxW, yMedian)
    ctx.stroke()
  })

  ctx.restore()
}

export const precomputedBoxPlotDrawer: DrawerFunction = function (props) {
  const { ctx, width, height, data } = props
  const stats = normalizeBoxStats(data as PrecomputedBoxPlotData)
  if (stats.length === 0) {
    return
  }
  drawBoxStats(ctx, width, height, stats)
}

export const rawBoxPlotDrawer: DrawerFunction = function (props) {
  const { ctx, width, height, data } = props
  const stats = normalizeTissueStats(data as RawTissueData)
  if (stats.length === 0) {
    return
  }
  drawBoxStats(ctx, width, height, stats)
}

function formatTick(value: number): string {
  if (Math.abs(value) >= 1000 || (Math.abs(value) < 0.01 && value !== 0)) {
    return value.toExponential(1)
  }
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

function truncateLabel(label: string, maxWidth: number): string {
  const approxChars = Math.max(3, Math.floor(maxWidth / 6))
  if (label.length <= approxChars) return label
  return `${label.slice(0, approxChars - 1)}…`
}
