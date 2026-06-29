import { useRef, useCallback, useReducer } from 'react'
import { observer } from 'mobx-react'

import {
  screenToData,
  pointInPolygon,
  pointsToPath,
  rectToPath,
} from './lassoMath.ts'

import type { SingleCellViewModel } from '../model.ts'

interface LassoOverlayProps {
  model: SingleCellViewModel
  width: number
  height: number
  onLassoEnd?: (selectedIndices: Set<number>) => void
  onRectEnd?: (selectedIndices: Set<number>) => void
}

export default observer(function LassoOverlay({
  model,
  width,
  height,
  onLassoEnd,
  onRectEnd,
}: LassoOverlayProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const isDrawingRef = useRef(false)
  const pointsRef = useRef<[number, number][]>([])
  const startPosRef = useRef({ x: 0, y: 0 })
  const [, forceRerender] = useReducer(x => x + 1, 0)

  const getPointsInPolygon = useCallback(
    (polygon: [number, number][]): Set<number> => {
      const data = model.data
      const cameraView = model.cameraView
      const bounds = model.embeddingBounds
      if (!data?.embeddingData || !cameraView || !bounds) return new Set()

      // Convert screen polygon vertices to data coordinates
      const dataPolygon = polygon.map(([sx, sy]) =>
        screenToData(sx, sy, width, height, cameraView, bounds),
      )

      const selected = new Set<number>()
      const n = data.embeddingData.length / 2

      for (let i = 0; i < n; i++) {
        const x = data.embeddingData[i * 2]!
        const y = data.embeddingData[i * 2 + 1]!
        if (pointInPolygon([x, y], dataPolygon)) {
          selected.add(i)
        }
      }
      return selected
    },
    [model.data, model.cameraView, model.embeddingBounds, width, height],
  )

  const getPointsInRect = useCallback(
    (sx0: number, sy0: number, sx1: number, sy1: number): Set<number> => {
      const data = model.data
      const cameraView = model.cameraView
      const bounds = model.embeddingBounds
      if (!data?.embeddingData || !cameraView || !bounds) return new Set()

      // Convert screen rect corners to data coordinates
      const [dx0, dy0] = screenToData(
        sx0,
        sy0,
        width,
        height,
        cameraView,
        bounds,
      )
      const [dx1, dy1] = screenToData(
        sx1,
        sy1,
        width,
        height,
        cameraView,
        bounds,
      )

      const selected = new Set<number>()
      const n = data.embeddingData.length / 2
      const minX = Math.min(dx0, dx1)
      const maxX = Math.max(dx0, dx1)
      const minY = Math.min(dy0, dy1)
      const maxY = Math.max(dy0, dy1)

      for (let i = 0; i < n; i++) {
        const x = data.embeddingData[i * 2]!
        const y = data.embeddingData[i * 2 + 1]!
        if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
          selected.add(i)
        }
      }
      return selected
    },
    [model.data, model.cameraView, model.embeddingBounds, width, height],
  )

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (model.selectionTool !== 'lasso' && model.selectionTool !== 'rect')
        return
      isDrawingRef.current = true
      const rect = svgRef.current?.getBoundingClientRect()
      if (!rect) return
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      pointsRef.current = [[x, y]]
      startPosRef.current = { x, y }
    },
    [model.selectionTool],
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDrawingRef.current) return
      const rect = svgRef.current?.getBoundingClientRect()
      if (!rect) return
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      if (model.selectionTool === 'lasso') {
        pointsRef.current.push([x, y])
        forceRerender()
      } else if (model.selectionTool === 'rect') {
        pointsRef.current = [
          [startPosRef.current.x, startPosRef.current.y],
          [x, y],
        ]
        forceRerender()
      }
    },
    [model.selectionTool, forceRerender],
  )

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
    forceRerender()
  }, [
    model.selectionTool,
    getPointsInPolygon,
    getPointsInRect,
    onLassoEnd,
    onRectEnd,
    forceRerender,
  ])

  // Render selection path
  const pathData = isDrawingRef.current
    ? model.selectionTool === 'lasso'
      ? pointsToPath(pointsRef.current)
      : rectToPath(pointsRef.current)
    : ''

  const showOverlay =
    model.selectionTool === 'lasso' || model.selectionTool === 'rect'

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
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
})