import { useEffect, useRef, useCallback } from 'react'
import { observer } from 'mobx-react'
import { mat3, vec2 } from 'gl-matrix'
import createRegl from 'regl'

import Camera from './camera.ts'
import createDrawPointsRegl from './drawPointsRegl.ts'
import {
  FRACTION_TO_USE,
  normalizeEmbedding,
  createModelTF,
  createProjectionTF,
} from './embeddingUtils.ts'
import { getCategoricalColorRGB, getContinuousRGB, getQuantileTs } from './colorUtils.ts'

import type { SingleCellViewModel, Transform } from '../model.ts'
import type {
  CategoricalColumn,
  ContinuousColumn,
  StringColumn,
} from '../../SingleCellAdapter/SingleCellZarrAdapter.ts'

function applyXTransform(
  values: Float32Array,
  transform: 'linear' | 'log',
): Float32Array {
  if (transform === 'linear') return values
  let min = Infinity
  for (const v of values) {
    if (v < min) min = v
  }
  if (!Number.isFinite(min)) return values
  const shift = min < 0 ? -min : 0
  const out = new Float32Array(values.length)
  for (let i = 0; i < values.length; i++) {
    out[i] = Math.log1p(values[i]! + shift)
  }
  return out
}

interface EmbeddingCanvasProps {
  model: SingleCellViewModel
  width: number
  height: number
}

// Pre-transform normalized [0,1] positions by the model matrix.
function applyModelTF(positions: Float32Array, modelTF: mat3): Float32Array {
  const n = positions.length / 2
  const out = new Float32Array(positions.length)
  const p = vec2.create()
  for (let i = 0; i < n; i++) {
    vec2.transformMat3(
      p,
      vec2.fromValues(positions[i * 2]!, positions[i * 2 + 1]!),
      modelTF,
    )
    out[i * 2] = p[0]
    out[i * 2 + 1] = p[1]
  }
  return out
}

// Compute colors based on colorBy column and selected palettes
function computeColors(
  colorBy: string,
  metadata: Record<string, CategoricalColumn | ContinuousColumn | StringColumn>,
  nPoints: number,
  categoricalPalette: string,
  continuousPalette: string,
  xTransform: Transform = 'linear',
  quantileColoring = false,
): Float32Array {
  const col = metadata[colorBy]
  const colors = new Float32Array(nPoints * 3)

  if (!col) {
    // Default: medium gray when the colorBy column failed to load
    colors.fill(0.5)
    return colors
  }

  if (col.type === 'categorical') {
    for (let i = 0; i < nPoints; i++) {
      const [r, g, b] = getCategoricalColorRGB(
        col.codes[i] ?? 0,
        categoricalPalette,
      )
      colors[i * 3] = r
      colors[i * 3 + 1] = g
      colors[i * 3 + 2] = b
    }
  } else if (col.type === 'string') {
    const valueToCode = new Map<string, number>()
    let nextCode = 0
    for (let i = 0; i < nPoints; i++) {
      const value = col.values[i] ?? ''
      let code = valueToCode.get(value)
      if (code === undefined) {
        code = nextCode++
        valueToCode.set(value, code)
      }
      const [r, g, b] = getCategoricalColorRGB(code, categoricalPalette)
      colors[i * 3] = r
      colors[i * 3 + 1] = g
      colors[i * 3 + 2] = b
    }
  } else {
    const values = applyXTransform(col.values, xTransform)
    const ts = quantileColoring ? getQuantileTs(values) : null
    const { min, max } = getMinMax(values)
    const range = max - min || 1
    for (let i = 0; i < nPoints; i++) {
      const v = ts ? ts[i]! : (values[i]! - min) / range
      const [r, g, b] = getContinuousRGB(v, continuousPalette)
      colors[i * 3] = r
      colors[i * 3 + 1] = g
      colors[i * 3 + 2] = b
    }
  }

  return colors
}

function getMinMax(arr: Float32Array): { min: number; max: number } {
  let min = Infinity,
    max = -Infinity
  for (const v of arr) {
    min = Math.min(min, v)
    max = Math.max(max, v)
  }
  return { min, max }
}

// Compute flags based on selection and label overlay mode
function computeFlags(
  n: number,
  selectedCells: Set<number>,
  highlightedCells: Set<number>,
  showLabels: boolean,
): Uint8Array {
  const flags = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    if (highlightedCells.has(i)) {
      flags[i] = 4 // FLAG_HIGHLIGHT
    } else if (selectedCells.has(i)) {
      flags[i] = 1 // FLAG_SELECTED
    } else if (selectedCells.size > 0 || showLabels) {
      flags[i] = 2 // FLAG_BACKGROUND (dim)
    }
  }
  return flags
}

export default observer(function EmbeddingCanvas({
  model,
  width,
  height,
}: EmbeddingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const reglRef = useRef<ReturnType<typeof createRegl> | undefined>(undefined)
  const drawPointsRef = useRef<
    ReturnType<typeof createDrawPointsRegl> | undefined
  >(undefined)
  const cameraRef = useRef(new Camera())
  const animFrameRef = useRef<number | undefined>(undefined)
  const isDraggingRef = useRef(false)
  const mousePosRef = useRef({ x: 0, y: 0 })

  const {
    data,
    colorBy,
    pointSize,
    showLabels,
    categoricalPalette,
    continuousPalette,
    quantileColoring,
  } = model
  const colorByKind = model.colorBy?.kind
  const colorByName = model.colorBy?.name
  // Read the active x-transform during render so mobx-react tracks it; using
  // the whole MST map as a useEffect dependency does not work because the map
  // reference does not change when a value is mutated in place.
  const xTransform =
    colorByKind === 'feature'
      ? (model.featureTransforms.get(colorByName ?? '')?.x ?? 'linear')
      : colorByKind === 'geneSet'
        ? (model.geneSetTransforms.get(colorByName ?? '')?.x ?? 'linear')
        : colorByKind === 'obs'
          ? (model.obsTransforms.get(colorByName ?? '')?.x ?? 'linear')
          : 'linear'

  // Read the active color-by values during render so only changes to the
  // specific feature/gene set trigger the color effect, not unrelated map
  // entries. The maps are also replaced wholesale on updates.
  const colorByFeatureValues =
    colorByKind === 'feature'
      ? model.featureValues.get(colorByName ?? '')
      : undefined
  const colorByGeneSetValues =
    colorByKind === 'geneSet'
      ? model.geneSetValues.get(colorByName ?? '')
      : undefined

  // Prepare geometry data. worldPositions are in the [-1,1] square after
  // applying the fixed 1:1 model transform.
  const worldPositionsRef = useRef<Float32Array | undefined>(undefined)
  const colorsRef = useRef<Float32Array | undefined>(undefined)
  const modelTFRef = useRef<mat3>(createModelTF())

  useEffect(() => {
    if (!data?.embeddingData) return
    const { data: normed, bounds } = normalizeEmbedding(data.embeddingData)
    model.setEmbeddingBounds(bounds.minX, bounds.maxX, bounds.minY, bounds.maxY)
    worldPositionsRef.current = applyModelTF(normed, modelTFRef.current)
  }, [data?.embeddingData, model])

  useEffect(() => {
    if (!data?.embeddingData) return
    const nPoints = data.embeddingData.length / 2
    const rawValues =
      colorByKind === 'feature'
        ? colorByFeatureValues
        : colorByKind === 'geneSet'
          ? colorByGeneSetValues
          : undefined
    if (rawValues) {
      const values = applyXTransform(rawValues, xTransform)
      const ts = quantileColoring ? getQuantileTs(values) : null
      const { min, max } = getMinMax(values)
      const range = max - min || 1
      const colors = new Float32Array(nPoints * 3)
      for (let i = 0; i < nPoints; i++) {
        const v = ts ? ts[i]! : (values[i]! - min) / range
        const [r, g, b] = getContinuousRGB(v, continuousPalette)
        colors[i * 3] = r
        colors[i * 3 + 1] = g
        colors[i * 3 + 2] = b
      }
      colorsRef.current = colors
      return
    }
    colorsRef.current = computeColors(
      colorByName ?? '',
      data.metadata,
      nPoints,
      categoricalPalette,
      continuousPalette,
      xTransform,
      quantileColoring,
    )
  }, [
    data,
    colorBy,
    colorByKind,
    colorByName,
    categoricalPalette,
    continuousPalette,
    quantileColoring,
    xTransform,
    colorByFeatureValues,
    colorByGeneSetValues,
  ])

  // Reset camera when switching embeddings so the new plot starts centered.
  useEffect(() => {
    cameraRef.current.reset()
  }, [model.embedding])

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
    const positions = worldPositionsRef.current
    const colors = colorsRef.current

    if (!canvas || !regl || !drawPoints || !positions || !colors) return

    // Sync camera view to model for coordinate transform in LassoOverlay
    model.setCameraView(new Float32Array(camera.view()))

    // Regl caches the viewport from context creation time; since the canvas
    // resizes after creation, poll() updates viewportWidth/Height before drawing.
    regl.poll()

    const projectionTF = createProjectionTF(width, height)
    const cameraTF = camera.view()
    const projView = mat3.create()
    mat3.multiply(projView, projectionTF, cameraTF)

    const nPoints = positions.length / 2
    if (colors.length !== nPoints * 3) {
      // Color buffer size mismatch: fallback to gray and skip this frame
      colorsRef.current = new Float32Array(nPoints * 3).fill(0.5)
      return
    }
    const flags = computeFlags(
      nPoints,
      model.selectedCells,
      model.highlightedCells,
      showLabels,
    )

    regl.clear({ color: [1, 1, 1, 1] })
    drawPoints({
      position: positions,
      color: colors,
      flag: flags,
      count: nPoints,
      projView: new Float32Array(projView),
      nPoints,
      minViewportDimension: Math.min(canvas.width, canvas.height),
      pointSize,
    })
  }, [
    model.selectedCells,
    model.highlightedCells,
    model,
    pointSize,
    showLabels,
    width,
    height,
  ])

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
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return
      if (model.selectionTool !== 'pan') return
      const canvas = canvasRef.current
      if (!canvas) return
      isDraggingRef.current = true
      const rect = canvas.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      mousePosRef.current = { x, y }
      cameraRef.current.onMouseDown(x, y)
    },
    [model.selectionTool],
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const canvas = canvasRef.current
      if (!canvas || !isDraggingRef.current) return
      if (model.selectionTool !== 'pan') return

      const rect = canvas.getBoundingClientRect()
      const projectionTF = createProjectionTF(width, height)
      cameraRef.current.onMouseMove(
        e.clientX - rect.left,
        e.clientY - rect.top,
        canvas.width,
        canvas.height,
        projectionTF,
      )
    },
    [model.selectionTool, width, height],
  )

  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false
  }, [])

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault()
      const canvas = canvasRef.current
      if (!canvas) return

      const rect = canvas.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const projectionTF = createProjectionTF(width, height)

      cameraRef.current.onWheel(
        e.deltaY,
        x,
        y,
        canvas.width,
        canvas.height,
        projectionTF,
      )
    },
    [width, height],
  )

  // Attach wheel listener as active (non-passive) so preventDefault works.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      canvas.removeEventListener('wheel', handleWheel)
    }
  }, [handleWheel])

  const handleDoubleClick = useCallback(() => {
    cameraRef.current.reset()
  }, [])

  if (!data?.embeddingData) {
    return <div>No embedding data available</div>
  }

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{
        width,
        height,
        cursor:
          model.selectionTool === 'pan'
            ? isDraggingRef.current
              ? 'grabbing'
              : 'grab'
            : 'crosshair',
        display: 'block',
        pointerEvents: model.selectionTool === 'pan' ? 'auto' : 'none',
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onDoubleClick={handleDoubleClick}
    />
  )
})
