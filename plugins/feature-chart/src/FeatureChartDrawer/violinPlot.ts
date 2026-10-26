import { resolveColorScheme } from './colorSchemes.ts'
import { scaleBand, scaleLinear } from './scales.ts'

import type { DrawerFunction } from './types.ts'

interface RawTissueData {
  tissues?: Record<string, number[]>
}

interface ViolinGroup {
  name: string
  values: number[]
  median: number
}

const KDE_STEPS = 40

function quantile(sorted: number[], p: number): number {
  const index = (sorted.length - 1) * p
  const lower = Math.floor(index)
  const upper = Math.ceil(index)
  const weight = index - lower
  return sorted[lower]! * (1 - weight) + sorted[upper]! * weight
}

function standardDeviation(values: number[], mean: number): number {
  if (values.length <= 1) {
    return 0
  }
  const variance =
    values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (values.length - 1)
  return Math.sqrt(variance)
}

function silvermanBandwidth(values: number[]): number {
  const n = values.length
  const sorted = [...values].sort((a, b) => a - b)
  const mean = values.reduce((sum, v) => sum + v, 0) / n
  const std = standardDeviation(values, mean)
  const iqr = quantile(sorted, 0.75) - quantile(sorted, 0.25)
  const sigma = Math.min(std, iqr / 1.34)
  const bw = 0.9 * sigma * n ** (-1 / 5)
  if (Number.isFinite(bw) && bw > 0) {
    return bw
  }
  const range = sorted[sorted.length - 1]! - sorted[0]!
  return range > 0 ? range / 10 : 1
}

function computeKde(
  values: number[],
  bandwidth: number,
  yMin: number,
  yMax: number,
  steps = KDE_STEPS,
): { y: number; density: number }[] {
  const result: { y: number; density: number }[] = []
  const factor = 1 / (values.length * bandwidth * Math.sqrt(2 * Math.PI))
  for (let i = 0; i < steps; i++) {
    const y = yMin + ((yMax - yMin) * i) / (steps - 1)
    let sum = 0
    for (const x of values) {
      const u = (y - x) / bandwidth
      sum += Math.exp(-0.5 * u * u)
    }
    result.push({ y, density: sum * factor })
  }
  return result
}

function normalizeViolinGroups(data: RawTissueData): ViolinGroup[] {
  const tissues = data.tissues
  if (!tissues || Object.keys(tissues).length === 0) {
    return []
  }

  return Object.entries(tissues)
    .map(([name, values]) => {
      if (!Array.isArray(values) || values.length === 0) {
        return undefined
      }
      const sorted = [...values].sort((a, b) => a - b)
      return { name, values, median: quantile(sorted, 0.5) }
    })
    .filter((g): g is ViolinGroup => g !== undefined)
}

function computeYDomain(groups: ViolinGroup[]): [number, number] | undefined {
  if (groups.length === 0) {
    return undefined
  }
  let min = Infinity
  let max = -Infinity
  for (const g of groups) {
    for (const v of g.values) {
      if (v < min) {
        min = v
      }
      if (v > max) {
        max = v
      }
    }
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return undefined
  }
  const padding = (max - min) * 0.05 || 1
  return [min - padding, max + padding]
}

export const rawViolinPlotDrawer: DrawerFunction = function (props) {
  const { ctx, width, height, data } = props
  const colorScheme = props.colorScheme ?? resolveColorScheme(props.theme)
  const groups = normalizeViolinGroups(data as RawTissueData)
  if (groups.length === 0) {
    return
  }

  const yDomain = computeYDomain(groups)
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

  const xScale = scaleBand()
    .domain(groups.map(d => d.name))
    .range([0, innerWidth])
    .padding(0.3)

  const yScale = scaleLinear().domain(yDomain).range([innerHeight, 0]).nice()

  // Background panel
  ctx.fillStyle = colorScheme.background
  ctx.fillRect(0, 0, width, height)

  ctx.save()
  ctx.translate(padding.left, padding.top)

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
    ctx.fillText(formatTick(tick), -8, y)
  }

  // X labels and violins
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  for (const [i, g] of groups.entries()) {
    const centerX = (xScale(g.name) ?? 0) + xScale.bandwidth() / 2
    const label = truncateLabel(g.name, xScale.bandwidth())
    ctx.fillStyle = colorScheme.text
    ctx.fillText(label, centerX, innerHeight + 6)

    const color = colorScheme.colors[i % colorScheme.colors.length]!
    const bandwidth = silvermanBandwidth(g.values)
    const densities = computeKde(g.values, bandwidth, yDomain[0], yDomain[1])
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
    for (const density_ of densities) {
      const { y, density } = density_
      const xOffset = widthScale(density)
      const px = centerX - xOffset
      const py = yScale(y)
      ctx.lineTo(px, py)
    }
    ctx.closePath()

    ctx.fillStyle = `${color}33` // 20% opacity
    ctx.fill()
    ctx.strokeStyle = color
    ctx.lineWidth = 1.5
    ctx.stroke()

    // Median line
    const medianY = yScale(g.median)
    ctx.strokeStyle = colorScheme.axis
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(centerX - maxHalfWidth * 0.2, medianY)
    ctx.lineTo(centerX + maxHalfWidth * 0.2, medianY)
    ctx.stroke()
  }

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
  if (label.length <= approxChars) {
    return label
  }
  return `${label.slice(0, approxChars - 1)}…`
}
