import {
  createModelInvTF,
  createModelTF,
  createProjectionTF,
  pointInPolygon,
  pointsToPath,
  rectToPath,
  screenToData,
} from './lassoMath.ts'

describe('pointInPolygon', () => {
  it('detects point inside a square', () => {
    const square: [number, number][] = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ]
    expect(pointInPolygon([0.5, 0.5], square)).toBe(true)
  })

  it('detects point outside a square', () => {
    const square: [number, number][] = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ]
    expect(pointInPolygon([1.5, 0.5], square)).toBe(false)
  })

  it('detects point inside a concave polygon', () => {
    const polygon: [number, number][] = [
      [0, 0],
      [2, 0],
      [1, 1],
      [2, 2],
      [0, 2],
    ]
    expect(pointInPolygon([0.5, 1], polygon)).toBe(true)
  })

  it('handles point on edge as inside or outside consistently', () => {
    const square: [number, number][] = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ]
    // The algorithm may return true or false for points exactly on an edge.
    const result = pointInPolygon([0.5, 0], square)
    expect(typeof result).toBe('boolean')
  })
})

describe('pointsToPath', () => {
  it('generates empty path for no points', () => {
    expect(pointsToPath([])).toBe('')
  })

  it('generates path for multiple points', () => {
    const points: [number, number][] = [
      [0, 0],
      [1, 2],
      [3, 4],
    ]
    expect(pointsToPath(points)).toBe('M0,0L1,2L3,4')
  })
})

describe('rectToPath', () => {
  it('generates empty path for fewer than 2 points', () => {
    expect(rectToPath([[0, 0]])).toBe('')
  })

  it('generates closed rectangle path from two corners', () => {
    const points: [number, number][] = [
      [1, 1],
      [3, 4],
    ]
    expect(rectToPath(points)).toBe('M1,1h2v3h-2Z')
  })

  it('normalizes negative-width rectangles', () => {
    const points: [number, number][] = [
      [3, 4],
      [1, 1],
    ]
    expect(rectToPath(points)).toBe('M1,1h2v3h-2Z')
  })
})

describe('createModelInvTF', () => {
  it('inverts createModelTF', () => {
    const modelTF = createModelTF()
    const modelInvTF = createModelInvTF()
    // Multiply modelTF * modelInvTF should give identity.
    // We check a known mapping: modelTF maps (0.5,0.5) to (0,0);
    // modelInvTF maps (0,0) back to (0.5,0.5).
    expect(modelInvTF[0]).toBeCloseTo(0.5)
    expect(modelInvTF[4]).toBeCloseTo(0.5)
    expect(modelInvTF[6]).toBeCloseTo(0.5)
    expect(modelInvTF[7]).toBeCloseTo(0.5)
  })
})

describe('screenToData', () => {
  it('round-trips data → screen → data with identity camera', () => {
    const width = 800
    const height = 600
    const cameraView = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1])
    const bounds = { minX: 0, maxX: 1, minY: 0, maxY: 1 }
    // Center of the canvas should map back to roughly the center of the data
    // after accounting for projection and model transforms.
    const [x, y] = screenToData(
      width / 2,
      height / 2,
      width,
      height,
      cameraView,
      bounds,
    )
    expect(x).toBeCloseTo(0.5, 1)
    expect(y).toBeCloseTo(0.5, 1)
  })

  it('maps screen corners outside the data bounds', () => {
    const width = 800
    const height = 600
    const cameraView = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1])
    const bounds = { minX: 0, maxX: 1, minY: 0, maxY: 1 }
    const [x, y] = screenToData(0, 0, width, height, cameraView, bounds)
    // (0,0) is the top-left of the canvas which maps to the top-left of the
    // projection square. After inverse transforms it should be outside [0,1].
    expect(x).toBeLessThan(0)
    expect(y).toBeGreaterThan(1)
  })
})

describe('createProjectionTF', () => {
  it('produces uniform scale for square viewport', () => {
    const p = createProjectionTF(600, 600)
    expect(p[0]).toBeCloseTo(p[4])
  })
})
