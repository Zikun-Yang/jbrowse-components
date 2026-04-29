import { mat3, vec2 } from 'gl-matrix'

const EPSILON = 0.000001
const scaleSpeed = 0.5
const scaleMax = 10.0
const scaleMin = 0.1

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
    const newScale = Math.max(scaleMin, Math.min(scaleMax, currentScale * factor))
    const actualFactor = newScale / currentScale

    if (Math.abs(1 - actualFactor) <= EPSILON) return

    // Zoom at point: translate to point, scale, translate back
    mat3.translate(m, m, [cx, cy])
    mat3.scale(m, m, [actualFactor, actualFactor])
    mat3.translate(m, m, [-cx, -cy])

    mat3.invert(this.viewMatrixInv, m)
  }

  screenToWorld(
    sx: number,
    sy: number,
    canvasWidth: number,
    canvasHeight: number,
  ): [number, number] {
    // Convert screen pixel to NDC [-1, 1]
    const ndcX = (2 * sx) / canvasWidth - 1
    const ndcY = 1 - (2 * sy) / canvasHeight

    // Apply inverse view transform
    const out = vec2.create()
    vec2.transformMat3(out, vec2.fromValues(ndcX, ndcY), this.viewMatrixInv)
    return [out[0], out[1]]
  }

  worldToScreen(
    wx: number,
    wy: number,
    canvasWidth: number,
    canvasHeight: number,
  ): [number, number] {
    const out = vec2.create()
    vec2.transformMat3(out, vec2.fromValues(wx, wy), this.viewMatrix)
    return [
      ((out[0] + 1) * canvasWidth) / 2,
      ((1 - out[1]) * canvasHeight) / 2,
    ]
  }

  onMouseDown(x: number, y: number) {
    this.prevX = x
    this.prevY = y
  }

  onMouseMove(x: number, y: number, canvasWidth: number, canvasHeight: number): boolean {
    const dx = x - this.prevX
    const dy = y - this.prevY
    this.prevX = x
    this.prevY = y

    if (dx === 0 && dy === 0) return false

    // Convert pixel delta to world delta
    const worldDx = (2 * dx) / (canvasWidth * this.viewMatrix[0])
    const worldDy = (-2 * dy) / (canvasHeight * this.viewMatrix[4])

    this.pan(worldDx, worldDy)
    return true
  }

  onWheel(
    deltaY: number,
    x: number,
    y: number,
    canvasWidth: number,
    canvasHeight: number,
  ): boolean {
    const factor = Math.exp(-deltaY * scaleSpeed * 0.01)
    const ndcX = (2 * x) / canvasWidth - 1
    const ndcY = 1 - (2 * y) / canvasHeight
    this.zoomAt(factor, ndcX, ndcY)
    return true
  }
}
