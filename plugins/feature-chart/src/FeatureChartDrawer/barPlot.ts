import { scaleBand, scaleLinear } from 'd3-scale'

import type { DrawerFunction } from './types.ts'

interface BarEntry {
  name: string
  value: number
  color?: string
}

interface BarPlotData {
  bars?: BarEntry[]
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

function normalizeBars(data: BarPlotData): BarEntry[] {
  if (!Array.isArray(data.bars) || data.bars.length === 0) {
    return []
  }

  return data.bars
    .map((bar): BarEntry | undefined => {
      const { name, value, color } = bar
      if (typeof name !== 'string' || !Number.isFinite(value)) {
        return undefined
      }
      return { name, value, ...(color ? { color } : {}) }
    })
    .filter((b): b is BarEntry => b !== undefined)
}

function computeYDomain(bars: BarEntry[]): [number, number] | undefined {
  if (bars.length === 0) return undefined
  let min = 0
  let max = -Infinity
  for (const b of bars) {
    if (b.value < min) min = b.value
    if (b.value > max) max = b.value
  }
  if (!Number.isFinite(max)) return undefined
  const padding = (max - min) * 0.05 || 1
  return [min - padding, max + padding]
}

export const barPlotDrawer: DrawerFunction = function (props) {
  const { ctx, width, height, data } = props
  const bars = normalizeBars(data as BarPlotData)
  if (bars.length === 0) {
    return
  }

  const yDomain = computeYDomain(bars)
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
    .domain(bars.map(d => d.name))
    .range([0, innerWidth])
    .padding(0.3)

  const yScale = scaleLinear().domain(yDomain).range([innerHeight, 0]).nice()
  const baselineY = yScale(0)

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

  // X labels and bars
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  bars.forEach((d, i) => {
    const x = (xScale(d.name) ?? 0) + xScale.bandwidth() / 2
    const label = truncateLabel(d.name, xScale.bandwidth())
    ctx.fillStyle = '#333333'
    ctx.fillText(label, x, innerHeight + 6)

    const color = d.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length]!
    const barX = xScale(d.name) ?? 0
    const barW = xScale.bandwidth()
    const barY = yScale(d.value)
    const barH = baselineY - barY

    ctx.fillStyle = color + '33' // 20% opacity
    ctx.strokeStyle = color
    ctx.lineWidth = 1.5
    ctx.fillRect(barX, Math.min(barY, baselineY), barW, Math.abs(barH))
    ctx.strokeRect(barX, Math.min(barY, baselineY), barW, Math.abs(barH))
  })

  ctx.restore()
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
