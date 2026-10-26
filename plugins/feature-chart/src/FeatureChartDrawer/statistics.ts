/**
 * Statistics shared by the painters that turn raw observations into marks.
 *
 * These used to live inside `boxPlot.ts` / `violinPlot.ts`; WP3 moved them here
 * because both the legacy drawers and the spec painters compute the same
 * numbers from the same model, and two copies would drift.
 */

export interface SummaryStats {
  min: number
  q1: number
  median: number
  q3: number
  max: number
}

const KDE_STEPS = 40

/** Linear-interpolated quantile of an already sorted array (d3.quantile). */
export function quantile(sorted: number[], p: number): number {
  const index = (sorted.length - 1) * p
  const lower = Math.floor(index)
  const upper = Math.ceil(index)
  const weight = index - lower
  return sorted[lower]! * (1 - weight) + sorted[upper]! * weight
}

/**
 * Five-number summary with the 1.5×IQR whisker clamp the built-ins have always
 * used: `min`/`max` are the most extreme observations inside
 * `[q1 - 1.5·IQR, q3 + 1.5·IQR]`, so outliers beyond them are not drawn.
 */
export function summarize(values: number[]): SummaryStats | undefined {
  if (values.length === 0) {
    return undefined
  }
  const sorted = [...values].sort((a, b) => a - b)
  const q1 = quantile(sorted, 0.25)
  const median = quantile(sorted, 0.5)
  const q3 = quantile(sorted, 0.75)
  const iqr = q3 - q1
  return {
    min: Math.max(sorted[0]!, q1 - 1.5 * iqr),
    q1,
    median,
    q3,
    max: Math.min(sorted[sorted.length - 1]!, q3 + 1.5 * iqr),
  }
}

export function median(values: number[]): number | undefined {
  if (values.length === 0) {
    return undefined
  }
  return quantile([...values].sort((a, b) => a - b), 0.5)
}

function standardDeviation(values: number[], mean: number): number {
  if (values.length <= 1) {
    return 0
  }
  const variance =
    values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (values.length - 1)
  return Math.sqrt(variance)
}

/** Silverman's rule of thumb, with the same fallbacks as before WP3. */
export function silvermanBandwidth(values: number[]): number {
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

export function computeKde(
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
