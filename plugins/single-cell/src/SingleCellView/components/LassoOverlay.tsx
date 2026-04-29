import { useRef, useCallback, useEffect } from 'react'

import type { SingleCellViewModel } from '../model.ts'

interface LassoOverlayProps {
  model: SingleCellViewModel
  onLassoEnd?: (selectedIndices: Set<number>) => void
  onRectEnd?: (selectedIndices: Set<number>) => void
}

export default function LassoOverlay({ model, onLassoEnd, onRectEnd }: LassoOverlayProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const isDrawingRef = useRef(false)
  const pointsRef = useRef<[number, number][]>([])
  const startPosRef = useRef({ x: 0, y: 0 })

  const getPointsInPolygon = useCallback(
    (polygon: [number, number][]): Set<number> => {
      const data = model.data
      if (!data?.embeddingData) return new Set()

      const selected = new Set<number>()
      const n = data.embeddingData.length / 2

      for (let i = 0; i < n; i++) {
        const x = data.embeddingData[i * 2]!
        const y = data.embeddingData[i * 2 + 1]!
        if (pointInPolygon([x, y], polygon)) {
          selected.add(i)
        }
      }
      return selected
    },
    [model.data],
  )

  const getPointsInRect = useCallback(
    (x0: number, y0: number, x1: number, y1: number): Set<number> => {
      const data = model.data
      if (!data?.embeddingData) return new Set()

      const selected = new Set<number>()
      const n = data.embeddingData.length / 2
      const minX = Math.min(x0, x1)
      const maxX = Math.max(x0, x1)
      const minY = Math.min(y0, y1)
      const maxY = Math.max(y0, y1)

      for (let i = 0; i < n; i++) {
        const x = data.embeddingData[i * 2]!
        const y = data.embeddingData[i * 2 + 1]!
        if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
          selected.add(i)
        }
      }
      return selected
    },
    [model.data],
  )

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (model.selectionTool !== 'lasso' && model.selectionTool !== 'rect') return
    isDrawingRef.current = true
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    pointsRef.current = [[x, y]]
    startPosRef.current = { x, y }
  }, [model.selectionTool])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDrawingRef.current) return
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    if (model.selectionTool === 'lasso') {
      pointsRef.current.push([x, y])
      forceUpdate()
    } else if (model.selectionTool === 'rect') {
      pointsRef.current = [
        [startPosRef.current.x, startPosRef.current.y],
        [x, y],
      ]
      forceUpdate()
    }
  }, [model.selectionTool])

  const handleMouseUp = useCallback(() => {
    if (!isDrawingRef.current) return
    isDrawingRef.current = false

    if (model.selectionTool === 'lasso') {
      const selected = getPointsInPolygon(pointsRef.current)
      onLassoEnd?.(selected)
    } else if (model.selectionTool === 'rect') {
      const [p0, p1] = pointsRef.current
      if (p0 && p1) {
        const selected = getPointsInRect(p0[0], p0[1], p1[0], p1[1])
        onRectEnd?.(selected)
      }
    }

    pointsRef.current = []
    forceUpdate()
  }, [model.selectionTool, getPointsInPolygon, getPointsInRect, onLassoEnd, onRectEnd])

  // Render selection path
  const pathData = isDrawingRef.current
    ? model.selectionTool === 'lasso'
      ? pointsToPath(pointsRef.current)
      : rectToPath(pointsRef.current)
    : ''

  const showOverlay = model.selectionTool === 'lasso' || model.selectionTool === 'rect'

  return (
    <svg
      ref={svgRef}
      width={model.width}
      height={model.height - 100}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: showOverlay ? 'auto' : 'none',
        cursor: showOverlay ? 'crosshair' : 'default',
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {pathData && (
        <path
          d={pathData}
          fill="rgba(66, 133, 244, 0.1)"
          stroke="#4285f4"
          strokeWidth={1}
          strokeDasharray="4,4"
        />
      )}
    </svg>
  )
}

// Force re-render helper
let updateCallback: (() => void) | null = null

function forceUpdate() {
  updateCallback?.()
}

// Utility functions
function pointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
  let inside = false
  const [x, y] = point
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]!
    const [xj, yj] = polygon[j]!
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}

function pointsToPath(points: [number, number][]): string {
  if (points.length === 0) return ''
  return `M${points.map(p => p.join(',')).join('L')}`
}

function rectToPath(points: [number, number][]): string {
  if (points.length < 2) return ''
  const [x0, y0] = points[0]!
  const [x1, y1] = points[1]!
  const minX = Math.min(x0, x1)
  const minY = Math.min(y0, y1)
  const w = Math.abs(x1 - x0)
  const h = Math.abs(y1 - y0)
  return `M${minX},${minY}h${w}v${h}h${-w}Z`
}
