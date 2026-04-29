import { useEffect, useRef, useCallback } from 'react'
import { mat3, vec2 } from 'gl-matrix'
import createRegl from 'regl'

import Camera from './camera.ts'
import createDrawPointsRegl from './drawPointsRegl.ts'

import type { SingleCellViewModel } from '../model.ts'
import type { CategoricalColumn, ContinuousColumn } from '../../SingleCellAdapter/SingleCellZarrAdapter.ts'

// Normalize embedding coordinates to [0, 1] range
function normalizeEmbedding(positions: Float32Array): Float32Array {
  const n = positions.length / 2
  let minX = Infinity, maxX = -Infinity
  let minY = Infinity, maxY = -Infinity

  for (let i = 0; i < n; i++) {
    const x = positions[i * 2]!
    const y = positions[i * 2 + 1]!
    minX = Math.min(minX, x)
    maxX = Math.max(maxX, x)
    minY = Math.min(minY, y)
    maxY = Math.max(maxY, y)
  }

  const scaleX = maxX - minX || 1
  const scaleY = maxY - minY || 1
  const out = new Float32Array(positions.length)

  for (let i = 0; i < n; i++) {
    out[i * 2] = (positions[i * 2]! - minX) / scaleX
    out[i * 2 + 1] = (positions[i * 2 + 1]! - minY) / scaleY
  }

  return out
}

// Compute colors based on colorBy column
function computeColors(
  colorBy: string,
  metadata: Record<string, CategoricalColumn | ContinuousColumn>,
): Float32Array {
  const col = metadata[colorBy]
  if (!col) {
    // Default: all black
    return new Float32Array(3)
  }

  const n = col.type === 'categorical' ? col.codes.length : col.values.length
  const colors = new Float32Array(n * 3)

  if (col.type === 'categorical') {
    // Use d3-like categorical colors
    const palette = [
      [0.12, 0.47, 0.71], // blue
      [1.0, 0.5, 0.05],   // orange
      [0.17, 0.63, 0.17], // green
      [0.84, 0.15, 0.16], // red
      [0.58, 0.4, 0.74],  // purple
      [0.55, 0.34, 0.29], // brown
      [0.89, 0.47, 0.76], // pink
      [0.5, 0.5, 0.5],    // gray
      [0.74, 0.74, 0.13], // olive
      [0.09, 0.75, 0.81], // cyan
    ]
    for (let i = 0; i < n; i++) {
      const code = col.codes[i] ?? 0
      const color = palette[code % palette.length]!
      colors[i * 3] = color[0]!
      colors[i * 3 + 1] = color[1]!
      colors[i * 3 + 2] = color[2]!
    }
  } else {
    // Continuous: viridis-like grayscale to blue-green
    const { min, max } = getMinMax(col.values)
    const range = max - min || 1
    for (let i = 0; i < n; i++) {
      const v = (col.values[i]! - min) / range
      const [r, g, b] = viridis(v)
      colors[i * 3] = r
      colors[i * 3 + 1] = g
      colors[i * 3 + 2] = b
    }
  }

  return colors
}

function getMinMax(arr: Float32Array): { min: number; max: number } {
  let min = Infinity, max = -Infinity
  for (const v of arr) {
    min = Math.min(min, v)
    max = Math.max(max, v)
  }
  return { min, max }
}

function viridis(t: number): [number, number, number] {
  // Simplified viridis colormap
  t = Math.max(0, Math.min(1, t))
  return [
    Math.max(0, Math.min(1, 0.267 + 0.105 * t + 0.63 * t * t - 0.213 * t * t * t)),
    Math.max(0, Math.min(1, 0.004 + 0.898 * t + 0.05 * t * t)),
    Math.max(0, Math.min(1, 0.329 + 0.644 * t - 0.867 * t * t + 0.27 * t * t * t)),
  ]
}

// Compute flags based on selection
function computeFlags(
  n: number,
  selectedCells: Set<number>,
  highlightedCells: Set<number>,
): Uint8Array {
  const flags = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    if (highlightedCells.has(i)) {
      flags[i] = 4 // FLAG_HIGHLIGHT
    } else if (selectedCells.has(i)) {
      flags[i] = 1 // FLAG_SELECTED
    } else if (selectedCells.size > 0) {
      flags[i] = 2 // FLAG_BACKGROUND (dim unselected)
    }
  }
  return flags
}

interface EmbeddingCanvasProps {
  model: SingleCellViewModel
}

export default function EmbeddingCanvas({ model }: EmbeddingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const reglRef = useRef<ReturnType<typeof createRegl> | undefined>(undefined)
  const drawPointsRef = useRef<ReturnType<typeof createDrawPointsRegl> | undefined>(undefined)
  const cameraRef = useRef(new Camera())
  const animFrameRef = useRef<number | undefined>(undefined)
  const isDraggingRef = useRef(false)
  const mousePosRef = useRef({ x: 0, y: 0 })

  const { data, colorBy } = model

  // Prepare geometry data
  const normPositions = useRef<Float32Array | undefined>(undefined)
  const colorsRef = useRef<Float32Array | undefined>(undefined)

  useEffect(() => {
    if (!data?.embeddingData) return
    normPositions.current = normalizeEmbedding(data.embeddingData)
  }, [data?.embeddingData])

  useEffect(() => {
    if (!data?.metadata || !colorBy) return
    colorsRef.current = computeColors(colorBy, data.metadata)
  }, [data?.metadata, colorBy])

  // Initialize regl
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const regl = createRegl({ canvas })
    reglRef.current = regl
    drawPointsRef.current = createDrawPointsRegl(regl)

    return () => {
      if (animFrameRef.current !== undefined) {
        cancelAnimationFrame(animFrameRef.current)
      }
      regl.destroy()
    }
  }, [])

  // Render loop
  const render = useCallback(() => {
    const canvas = canvasRef.current
    const regl = reglRef.current
    const drawPoints = drawPointsRef.current
    const camera = cameraRef.current
    const positions = normPositions.current
    const colors = colorsRef.current

    if (!canvas || !regl || !drawPoints || !positions || !colors) return

    // Scale normalized [0,1] to WebGL [-1,1]
    const modelTF = mat3.create()
    mat3.fromScaling(modelTF, vec2.fromValues(2, 2))
    mat3.translate(modelTF, modelTF, vec2.fromValues(-0.5, -0.5))

    const projView = mat3.create()
    mat3.multiply(projView, camera.view(), modelTF)

    const nPoints = positions.length / 2
    const flags = computeFlags(nPoints, model.selectedCells, model.highlightedCells)

    regl.clear({ color: [1, 1, 1, 1] })
    drawPoints({
      position: positions,
      color: colors,
      flag: flags,
      count: nPoints,
      projView: new Float32Array(projView),
      nPoints,
      minViewportDimension: Math.min(canvas.width, canvas.height),
    })
  }, [model.selectedCells, model.highlightedCells])

  // Animation loop
  useEffect(() => {
    const loop = () => {
      render()
      animFrameRef.current = requestAnimationFrame(loop)
    }
    animFrameRef.current = requestAnimationFrame(loop)
    return () => {
      if (animFrameRef.current !== undefined) {
        cancelAnimationFrame(animFrameRef.current)
      }
    }
  }, [render])

  // Mouse handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    isDraggingRef.current = true
    mousePosRef.current = { x: e.clientX, y: e.clientY }
    cameraRef.current.onMouseDown(e.clientX, e.clientY)
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current
    if (!canvas || !isDraggingRef.current) return

    cameraRef.current.onMouseMove(
      e.clientX,
      e.clientY,
      canvas.width,
      canvas.height,
    )
  }, [])

  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false
  }, [])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    cameraRef.current.onWheel(
      e.deltaY,
      x,
      y,
      canvas.width,
      canvas.height,
    )
  }, [])

  const handleDoubleClick = useCallback(() => {
    cameraRef.current.reset()
  }, [])

  if (!data?.embeddingData) {
    return <div>No embedding data available</div>
  }

  return (
    <canvas
      ref={canvasRef}
      width={model.width}
      height={model.height - 100}
      style={{
        width: model.width,
        height: model.height - 100,
        cursor: isDraggingRef.current ? 'grabbing' : 'grab',
        display: 'block',
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      onDoubleClick={handleDoubleClick}
    />
  )
}
