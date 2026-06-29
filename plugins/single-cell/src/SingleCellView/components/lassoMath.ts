import { mat3, vec2 } from 'gl-matrix'

import { createModelTF, createProjectionTF } from './embeddingUtils.ts'

const FRACTION_TO_USE = 0.85

export { FRACTION_TO_USE, createModelTF, createProjectionTF }

// Inverse of the model transform: [-1,1] world → [0,1] data.
export function createModelInvTF(): mat3 {
  const m = mat3.fromTranslation(mat3.create(), [0.5, 0.5])
  mat3.scale(m, m, [0.5, 0.5])
  return m
}

/**
 * Convert screen pixel coordinates to raw embedding data coordinates.
 *
 * Transform chain:
 *   raw_embedding → normalize [0,1] → modelTF → [-1,1] → camera.view
 *   → projectionTF → NDC [-1,1] → screen
 *
 * Reversed here to go from screen back to raw data.
 */
export function screenToData(
  sx: number,
  sy: number,
  canvasW: number,
  canvasH: number,
  cameraView: Float32Array,
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
): [number, number] {
  // Step 1: screen pixel → NDC [-1, 1]
  const ndcX = (2 * sx) / canvasW - 1
  const ndcY = 1 - (2 * sy) / canvasH

  // Step 2: NDC → view (inverse projection)
  const projectionTF = createProjectionTF(canvasW, canvasH)
  const projectionInvTF = mat3.create()
  mat3.invert(projectionInvTF, projectionTF)
  const view = vec2.create()
  vec2.transformMat3(view, vec2.fromValues(ndcX, ndcY), projectionInvTF)

  // Step 3: view → world (inverse camera)
  const cameraInvTF = mat3.create()
  mat3.invert(cameraInvTF, cameraView as unknown as mat3)
  const world = vec2.create()
  vec2.transformMat3(world, view, cameraInvTF)

  // Step 4: world [-1,1] → normalized [0,1] (inverse modelTF)
  const modelInvTF = createModelInvTF()
  const norm = vec2.create()
  vec2.transformMat3(norm, world, modelInvTF)

  // Step 5: normalized [0,1] → raw data
  const dataX = norm[0] * (bounds.maxX - bounds.minX) + bounds.minX
  const dataY = norm[1] * (bounds.maxY - bounds.minY) + bounds.minY

  return [dataX, dataY]
}

export function pointInPolygon(
  point: [number, number],
  polygon: [number, number][],
): boolean {
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

export function pointsToPath(points: [number, number][]): string {
  if (points.length === 0) return ''
  return `M${points.map(p => p.join(',')).join('L')}`
}

export function rectToPath(points: [number, number][]): string {
  if (points.length < 2) return ''
  const [x0, y0] = points[0]!
  const [x1, y1] = points[1]!
  const minX = Math.min(x0, x1)
  const minY = Math.min(y0, y1)
  const w = Math.abs(x1 - x0)
  const h = Math.abs(y1 - y0)
  return `M${minX},${minY}h${w}v${h}h${-w}Z`
}
