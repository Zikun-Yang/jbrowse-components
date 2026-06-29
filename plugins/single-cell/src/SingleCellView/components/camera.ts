import { mat3, vec2 } from 'gl-matrix'

const EPSILON = 0.000001
const scaleSpeed = 0.5
const scaleMax = 10.0
const scaleMin = 0.1

// Scratch buffers to avoid allocating every event
const scratch0 = new Float32Array(16)
const scratch1 = new Float32Array(16)

function invertMat3(m: mat3): mat3 {
  const out = mat3.create()
  const result = mat3.invert(out, m)
  if (!result) {
    mat3.identity(out)
  }
  return out
}

export default class Camera {
  private viewMatrix = mat3.create()
  private viewMatrixInv = mat3.create()
  private prevX = 0
  private prevY = 0

  constructor() {
    // Start with identity (no transform)
    mat3.identity(this.viewMatrix)
    mat3.invert(this.viewMatrixInv, this.viewMatrix)
  }

  view(): mat3 {
    return this.viewMatrix
  }

  invView(): mat3 {
    return this.viewMatrixInv
  }

  distance(): number {
    return this.viewMatrix[0]
  }

  reset() {
    mat3.identity(this.viewMatrix)
    mat3.invert(this.viewMatrixInv, this.viewMatrix)
  }

  pan(dx: number, dy: number) {
    const m = this.viewMatrix
    mat3.translate(m, m, [dx, dy])
    mat3.invert(this.viewMatrixInv, m)
  }

  zoomAt(factor: number, cx: number, cy: number) {
    const m = this.viewMatrix
    const currentScale = m[0]
    const newScale = Math.max(
      scaleMin,
      Math.min(scaleMax, currentScale * factor),
    )
    const actualFactor = newScale / currentScale

    if (Math.abs(1 - actualFactor) <= EPSILON) return

    // Zoom at point: translate to point, scale, translate back
    mat3.translate(m, m, [cx, cy])
    mat3.scale(m, m, [actualFactor, actualFactor])
    mat3.translate(m, m, [-cx, -cy])

    mat3.invert(this.viewMatrixInv, m)
  }

  /**
   * Convert screen pixel coordinates to world coordinates ([-1, 1] square
   * before projection). When projectionInvTF is provided, the inverse
   * projection is applied first so the result is in the same coordinate
   * system the camera operates in.
   */
  screenToWorld(
    sx: number,
    sy: number,
    canvasWidth: number,
    canvasHeight: number,
    projectionInvTF?: mat3,
  ): [number, number] {
    // Convert screen pixel to NDC [-1, 1]
    const ndcX = (2 * sx) / canvasWidth - 1
    const ndcY = 1 - (2 * sy) / canvasHeight

    const out = vec2.fromValues(ndcX, ndcY)
    if (projectionInvTF) {
      vec2.transformMat3(out, out, projectionInvTF)
    }
    vec2.transformMat3(out, out, this.viewMatrixInv)
    return [out[0], out[1]]
  }

  worldToScreen(
    wx: number,
    wy: number,
    canvasWidth: number,
    canvasHeight: number,
    projectionTF?: mat3,
  ): [number, number] {
    const out = vec2.create()
    vec2.transformMat3(out, vec2.fromValues(wx, wy), this.viewMatrix)
    if (projectionTF) {
      vec2.transformMat3(out, out, projectionTF)
    }
    return [((out[0] + 1) * canvasWidth) / 2, ((1 - out[1]) * canvasHeight) / 2]
  }

  onMouseDown(x: number, y: number) {
    this.prevX = x
    this.prevY = y
  }

  onMouseMove(
    x: number,
    y: number,
    canvasWidth: number,
    canvasHeight: number,
    projectionTF?: mat3,
  ): boolean {
    const projectionInvTF = projectionTF ? invertMat3(projectionTF) : undefined
    const prev = this.screenToWorld(
      this.prevX,
      this.prevY,
      canvasWidth,
      canvasHeight,
      projectionInvTF,
    )
    const curr = this.screenToWorld(
      x,
      y,
      canvasWidth,
      canvasHeight,
      projectionInvTF,
    )

    this.prevX = x
    this.prevY = y

    const dx = curr[0] - prev[0]
    const dy = curr[1] - prev[1]

    if (dx === 0 && dy === 0) return false

    this.pan(dx, dy)
    return true
  }

  onWheel(
    deltaY: number,
    x: number,
    y: number,
    canvasWidth: number,
    canvasHeight: number,
    projectionTF?: mat3,
  ): boolean {
    const projectionInvTF = projectionTF ? invertMat3(projectionTF) : undefined
    const pos = this.screenToWorld(
      x,
      y,
      canvasWidth,
      canvasHeight,
      projectionInvTF,
    )

    const factor = Math.exp(-deltaY * scaleSpeed * 0.01)
    this.zoomAt(factor, pos[0], pos[1])
    return true
  }
}
