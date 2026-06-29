import { mat3, vec2 } from 'gl-matrix'

// Fraction of the viewport used for the embedding. The remaining area is
// padding so the plot stays centered and unclipped on resize.
export const FRACTION_TO_USE = 0.85

export function percentile(sortedArr: Float32Array, p: number): number {
  const arr = Array.from(sortedArr).sort((a, b) => a - b)
  const index = p * (arr.length - 1)
  const lower = Math.floor(index)
  const upper = Math.ceil(index)
  const weight = index - lower
  if (upper >= arr.length) return arr[lower]!
  return arr[lower]! * (1 - weight) + arr[upper]! * weight
}

// Normalize embedding coordinates to [0, 1] range using percentile bounds to
// avoid a few extreme outliers forcing the main clusters into a small region.
export function normalizeEmbedding(
  positions: Float32Array,
  lowerPct = 0.01,
  upperPct = 0.99,
): {
  data: Float32Array
  bounds: { minX: number; maxX: number; minY: number; maxY: number }
} {
  const n = positions.length / 2
  const xs = new Float32Array(n)
  const ys = new Float32Array(n)

  for (let i = 0; i < n; i++) {
    xs[i] = positions[i * 2]!
    ys[i] = positions[i * 2 + 1]!
  }

  const minX = percentile(xs, lowerPct)
  const maxX = percentile(xs, upperPct)
  const minY = percentile(ys, lowerPct)
  const maxY = percentile(ys, upperPct)

  const scaleX = maxX - minX || 1
  const scaleY = maxY - minY || 1
  const data = new Float32Array(positions.length)

  for (let i = 0; i < n; i++) {
    data[i * 2] = (positions[i * 2]! - minX) / scaleX
    data[i * 2 + 1] = (positions[i * 2 + 1]! - minY) / scaleY
  }

  return { data, bounds: { minX, maxX, minY, maxY } }
}

// Data arrives normalized to [0,1]. Convert to WebGL world space [-1,1]
// with a fixed 1:1 aspect ratio.
export function createModelTF(): mat3 {
  const m = mat3.fromScaling(mat3.create(), vec2.fromValues(2, 2))
  mat3.translate(m, m, [-0.5, -0.5])
  return m
}

// The projection transform accounts for the viewport size. It uniformly
// scales the square [-1,1] world so it occupies FRACTION_TO_USE of the
// smaller viewport dimension, then centers it. This is the only transform
// that changes on resize, so the embedding is never stretched.
export function createProjectionTF(
  viewportWidth: number,
  viewportHeight: number,
): mat3 {
  const minDim = Math.min(viewportWidth, viewportHeight)
  const scale = (FRACTION_TO_USE * minDim) / viewportWidth
  const sy = (FRACTION_TO_USE * minDim) / viewportHeight
  return mat3.fromScaling(mat3.create(), vec2.fromValues(scale, sy))
}

// Apply the full model-camera-projection chain to a normalized [0,1] point.
export function normalizedToScreen(
  x: number,
  y: number,
  cameraView: Float32Array | null,
  width: number,
  height: number,
): [number, number] {
  const modelTF = createModelTF()
  const projectionTF = createProjectionTF(width, height)
  const view = cameraView ?? mat3.create()
  const mvp = mat3.create()
  mat3.multiply(mvp, projectionTF, view)
  mat3.multiply(mvp, mvp, modelTF)
  const p = vec2.create()
  vec2.transformMat3(p, vec2.fromValues(x, y), mvp)
  return [((p[0] + 1) * width) / 2, ((1 - p[1]) * height) / 2]
}
