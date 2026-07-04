import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'

import { getContinuousHex } from './colorUtils.ts'

import type { Transform } from '../model.ts'

function applyYTransform(count: number, transform: Transform): number {
  return transform === 'linear' ? count : Math.log1p(count)
}

const useStyles = makeStyles()({
  root: {
    position: 'relative',
    userSelect: 'none',
    fontSize: 11,
    width: '100%',
  },
  svg: {
    display: 'block',
    width: '100%',
  },
  rangeText: {
    display: 'flex',
    justifyContent: 'space-between',
    color: '#666',
    fontSize: 11,
    marginTop: 2,
  },
})

interface HistogramBrushProps {
  values: ArrayLike<number>
  height?: number
  bins?: number
  initialRange?: { min: number; max: number } | null
  isColorBy?: boolean
  label?: string
  palette?: string
  yTransform?: Transform
  onChange: (range: { min: number; max: number } | null) => void
}

function formatNumber(v: number): string {
  if (!Number.isFinite(v)) return String(v)
  const abs = Math.abs(v)
  if (abs === 0) return '0'
  if (abs >= 1e6 || abs < 1e-3) return v.toExponential(2)
  if (Number.isInteger(v)) return String(v)
  return v.toFixed(2)
}

export default function HistogramBrush({
  values,
  height = 110,
  bins = 50,
  initialRange = null,
  isColorBy = false,
  label,
  palette = 'viridis',
  yTransform = 'linear',
  onChange,
}: HistogramBrushProps) {
  const { classes } = useStyles()
  const rootRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [range, setRange] = useState<{ min: number; max: number } | null>(
    initialRange ?? null,
  )
  const [dragStart, setDragStart] = useState<number | null>(null)
  const [dragCurrent, setDragCurrent] = useState<number | null>(null)
  const [width, setWidth] = useState(220)

  // Sync internal range when the parent clears or resets it (e.g. on transform
  // change), without overwriting an in-progress drag.
  useEffect(() => {
    if (dragStart === null) {
      setRange(initialRange ?? null)
    }
  }, [initialRange, dragStart])

  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        setWidth(entry.contentRect.width)
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const padding = { top: 16, bottom: 28, left: 24, right: 40 }
  const plotWidth = Math.max(0, width - padding.left - padding.right)
  const plotHeight = height - padding.top - padding.bottom

  const { min, max, counts } = useMemo(() => {
    let min = Infinity
    let max = -Infinity
    for (let i = 0; i < values.length; i++) {
      const v = values[i]!
      min = Math.min(min, v)
      max = Math.max(max, v)
    }
    const counts = new Array(bins).fill(0)
    const range = max - min || 1
    for (let i = 0; i < values.length; i++) {
      const v = values[i]!
      const bin = Math.min(bins - 1, Math.floor(((v - min) / range) * bins))
      counts[bin] = (counts[bin] ?? 0) + 1
    }
    return { min, max, counts }
  }, [values, bins])

  const maxCount = Math.max(
    ...counts.map(c => applyYTransform(c ?? 0, yTransform)),
    1,
  )
  const binWidth = plotWidth / bins

  const valueToX = useCallback(
    (v: number) => {
      if (!Number.isFinite(min) || !Number.isFinite(max) || max === min) {
        return padding.left
      }
      return padding.left + ((v - min) / (max - min)) * plotWidth
    },
    [min, max, plotWidth],
  )

  const xToValue = useCallback(
    (x: number) => {
      const t = Math.max(0, Math.min(1, (x - padding.left) / plotWidth))
      return min + t * (max - min)
    },
    [min, max, plotWidth],
  )

  const commit = useCallback(
    (next: { min: number; max: number } | null) => {
      setRange(next)
      onChange(next)
    },
    [onChange],
  )

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!svgRef.current) return
      const rect = svgRef.current.getBoundingClientRect()
      const v = xToValue(e.clientX - rect.left)
      setDragStart(v)
      setDragCurrent(v)
    },
    [xToValue],
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (dragStart === null || !svgRef.current) return
      const rect = svgRef.current.getBoundingClientRect()
      setDragCurrent(xToValue(e.clientX - rect.left))
    },
    [dragStart, xToValue],
  )

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (dragStart === null || !svgRef.current) return
      const rect = svgRef.current.getBoundingClientRect()
      const end = xToValue(e.clientX - rect.left)
      const nextMin = Math.max(min, Math.min(dragStart, end))
      const nextMax = Math.min(max, Math.max(dragStart, end))
      if (nextMax - nextMin > (max - min) * 0.001) {
        commit({ min: nextMin, max: nextMax })
      } else if (range) {
        commit(null)
      }
      setDragStart(null)
      setDragCurrent(null)
    },
    [dragStart, min, max, range, xToValue, commit],
  )

  const handleMouseLeave = useCallback(() => {
    if (dragStart !== null) {
      setDragStart(null)
      setDragCurrent(null)
    }
  }, [dragStart])

  // Active selection: committed range or in-progress drag
  const selectionMin =
    dragStart !== null && dragCurrent !== null
      ? Math.max(min, Math.min(dragStart, dragCurrent))
      : (range?.min ?? null)
  const selectionMax =
    dragStart !== null && dragCurrent !== null
      ? Math.min(max, Math.max(dragStart, dragCurrent))
      : (range?.max ?? null)

  const selectionX = selectionMin !== null ? valueToX(selectionMin) : null
  const selectionW =
    selectionMax !== null && selectionX !== null
      ? valueToX(selectionMax) - selectionX
      : 0

  const yTicks = [0, maxCount]
  const xTicks = [min, (min + max) / 2, max]

  return (
    <div
      ref={rootRef}
      className={classes.root}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >
      <svg
        ref={svgRef}
        className={classes.svg}
        width={width}
        height={height}
        onMouseDown={handleMouseDown}
      >
        {/* Histogram bars */}
        {counts.map((count, i) => {
          const h =
            (applyYTransform(count ?? 0, yTransform) / maxCount) * plotHeight
          const t = (i + 0.5) / bins
          return (
            <rect
              key={i}
              x={padding.left + i * binWidth}
              y={padding.top + plotHeight - h}
              width={Math.max(1, binWidth - 1)}
              height={h}
              fill={isColorBy ? getContinuousHex(t, palette) : '#aaaaaa'}
            />
          )
        })}

        {/* Selection overlay */}
        {selectionX !== null && selectionW > 0 ? (
          <rect
            x={selectionX}
            y={padding.top}
            width={selectionW}
            height={plotHeight}
            fill="rgba(0, 0, 0, 0.15)"
          />
        ) : null}

        {/* X axis */}
        <line
          x1={padding.left}
          y1={padding.top + plotHeight}
          x2={padding.left + plotWidth}
          y2={padding.top + plotHeight}
          stroke="#ccc"
          strokeWidth={1}
        />
        {xTicks.map((tick, i) => {
          const x = valueToX(tick)
          return (
            <g key={i}>
              <line
                x1={x}
                y1={padding.top + plotHeight}
                x2={x}
                y2={padding.top + plotHeight + 4}
                stroke="#ccc"
                strokeWidth={1}
              />
              <text
                x={x}
                y={padding.top + plotHeight + 14}
                fontSize={10}
                fill="#666"
                textAnchor="middle"
              >
                {formatNumber(tick)}
              </text>
            </g>
          )
        })}

        {/* Y axis (right) */}
        <line
          x1={padding.left + plotWidth}
          y1={padding.top}
          x2={padding.left + plotWidth}
          y2={padding.top + plotHeight}
          stroke="#ccc"
          strokeWidth={1}
        />
        {yTicks.map((tick, i) => {
          const y = padding.top + plotHeight - (tick / maxCount) * plotHeight
          return (
            <g key={tick}>
              <line
                x1={padding.left + plotWidth}
                y1={y}
                x2={padding.left + plotWidth + 4}
                y2={y}
                stroke="#ccc"
                strokeWidth={1}
              />
              <text
                x={padding.left + plotWidth + 6}
                y={y + (i === 0 ? 3 : -3)}
                fontSize={10}
                fill="#666"
              >
                {tick.toLocaleString()}
              </text>
            </g>
          )
        })}
      </svg>
      <div className={classes.rangeText}>
        <span>min {formatNumber(min)}</span>
        <span>{label}</span>
        <span>max {formatNumber(max)}</span>
      </div>
    </div>
  )
}
