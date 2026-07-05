import { useEffect, useRef } from 'react'

import { buildQuantileContext, getContinuousHex, valueToQuantile } from './colorUtils.ts'
import type { Transform } from '../model.ts'

function applyYTransform(count: number, transform: Transform): number {
  return transform === 'linear' ? count : Math.log1p(count)
}

interface MiniHistogramProps {
  /**
   * Continuous color-by value per cell.
   */
  values: ArrayLike<number>
  /**
   * Set of cell indices belonging to the row being summarized.
   */
  indices: Set<number>
  width?: number
  height?: number
  bins?: number
  palette?: string
  /**
   * Optional single color used for all bars. When provided it overrides the
   * continuous palette.
   */
  color?: string
  yTransform?: Transform
  quantileMode?: boolean
}

export default function MiniHistogram({
  values,
  indices,
  width = 100,
  height = 11,
  bins = 20,
  palette = 'viridis',
  color,
  yTransform = 'linear',
  quantileMode = false,
}: MiniHistogramProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || indices.size === 0) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Collect subset values and min/max.
    let min = Infinity
    let max = -Infinity
    const subset: number[] = []
    for (const idx of indices) {
      const v = values[idx]
      if (v === undefined) continue
      subset.push(v)
      min = Math.min(min, v)
      max = Math.max(max, v)
    }
    if (subset.length === 0 || !Number.isFinite(min) || !Number.isFinite(max)) {
      return
    }

    const counts = new Array(bins).fill(0)
    const range = max - min || 1
    for (const v of subset) {
      const bin = Math.min(bins - 1, Math.floor(((v - min) / range) * bins))
      counts[bin] = (counts[bin] ?? 0) + 1
    }
    const maxCount = Math.max(
      ...counts.map(c => applyYTransform(c ?? 0, yTransform)),
    )

    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, width, height)

    const ctxQ = quantileMode ? buildQuantileContext(subset) : null
    const binWidth = width / bins
    for (let i = 0; i < bins; i++) {
      const count = counts[i] ?? 0
      if (count === 0) continue
      const h = (applyYTransform(count, yTransform) / (maxCount || 1)) * height
      const centerValue = min + ((i + 0.5) / bins) * range
      const t = ctxQ
        ? valueToQuantile(ctxQ, centerValue)
        : (i + 0.5) / bins
      ctx.fillStyle = color ?? getContinuousHex(t, palette)
      ctx.fillRect(i * binWidth, height - h, binWidth - 1, h)
    }
  }, [values, indices, width, height, bins, palette, yTransform, quantileMode])

  return (
    <canvas
      ref={canvasRef}
      style={{
        width,
        height,
        display: indices.size > 0 ? 'block' : 'none',
      }}
    />
  )
}
