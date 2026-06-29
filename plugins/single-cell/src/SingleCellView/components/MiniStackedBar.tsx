import { useEffect, useRef } from 'react'

import { getCategoricalColor } from './colorUtils.ts'

interface MiniStackedBarProps {
  /**
   * Category labels for the current color-by column.
   */
  categories: string[]
  /**
   * Integer code per cell pointing into `categories`.
   */
  codes: ArrayLike<number>
  /**
   * Set of cell indices belonging to the row being summarized.
   */
  indices: Set<number>
  width?: number
  height?: number
  palette?: string
}

export default function MiniStackedBar({
  categories,
  codes,
  indices,
  width = 100,
  height = 11,
  palette = 'tab10',
}: MiniStackedBarProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || indices.size === 0) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Count color-by category occurrences within the selected indices.
    const counts = new Array(categories.length).fill(0)
    for (const idx of indices) {
      const code = codes[idx]
      if (code !== undefined && code >= 0 && code < counts.length) {
        counts[code] = (counts[code] ?? 0) + 1
      }
    }

    const total = counts.reduce((sum, c) => sum + c, 0)
    if (total === 0) return

    // Device pixel ratio aware canvas.
    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, width, height)

    let x = 0
    for (let i = 0; i < counts.length; i++) {
      const count = counts[i] ?? 0
      if (count === 0) continue
      const w = (count / total) * width
      ctx.fillStyle = getCategoricalColor(i, palette)
      ctx.fillRect(x, 0, w, height)
      x += w
    }
  }, [categories, codes, indices, width, height, palette])

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
