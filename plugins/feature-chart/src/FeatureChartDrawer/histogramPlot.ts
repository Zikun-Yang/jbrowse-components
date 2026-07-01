import { scaleLinear } from 'd3-scale'

import type { DrawerFunction } from './types.ts'

interface HistogramData {
  values?: number[]
  bins?: number
}

const DEFAULT_COLOR = '#4e79a7'
const DEFAULT_BINS = 10

function normalizeValues(data: HistogramData): number[] {
  if (!Array.isArray(data.values) || data.values.length === 0) {
    return []
  }
  return data.values.filter((v): v is number => Number.isFinite(v))
}

function computeBins(
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
    if (index < 0) index = 0
    if (index >= binCount) index = binCount - 1
    counts[index]!++
  }

  return { edges, counts }
}

export const histogramPlotDrawer: DrawerFunction = function (props) {
  const { ctx, width, height, data } = props
  const values = normalizeValues(data as HistogramData)
  if (values.length === 0) {
    return
  }

  const binCount =
    typeof (data as HistogramData).bins === 'number' &&
    (data as HistogramData).bins! > 0
      ? (data as HistogramData).bins!
      : DEFAULT_BINS

  const { edges, counts } = computeBins(values, binCount)
  const maxCount = Math.max(...counts)
  if (!Number.isFinite(maxCount) || maxCount <= 0) {
    return
  }

  const xMin = edges[0]!
  const xMax = edges[edges.length - 1]!

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

  const xScale = scaleLinear()
    .domain([xMin, xMax])
    .range([0, innerWidth])
    .nice()
  const yScale = scaleLinear()
    .domain([0, maxCount])
    .range([innerHeight, 0])
    .nice()

  // Background panel
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

  // Axes
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
    ctx.fillText(String(tick), -8, y)
  })

  // X ticks and labels
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  xScale.ticks(5).forEach(tick => {
    const x = xScale(tick)
    ctx.beginPath()
    ctx.moveTo(x, innerHeight)
    ctx.lineTo(x, innerHeight + 4)
    ctx.stroke()
    ctx.fillText(formatTick(tick), x, innerHeight + 6)
  })

  // Histogram bars
  ctx.fillStyle = DEFAULT_COLOR + '33' // 20% opacity
  ctx.strokeStyle = DEFAULT_COLOR
  ctx.lineWidth = 1.5
  for (let i = 0; i < counts.length; i++) {
    const x0 = xScale(edges[i]!)
    const x1 = xScale(edges[i + 1]!)
    const barX = Math.min(x0, x1)
    const barW = Math.abs(x1 - x0)
    const barH = innerHeight - yScale(counts[i]!)
    const barY = innerHeight - barH

    if (barW <= 0 || barH <= 0) continue

    ctx.fillRect(barX, barY, barW, barH)
    ctx.strokeRect(barX, barY, barW, barH)
  }

  ctx.restore()
}

function formatTick(value: number): string {
  if (Math.abs(value) >= 1000 || (Math.abs(value) < 0.01 && value !== 0)) {
    return value.toExponential(1)
  }
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}
