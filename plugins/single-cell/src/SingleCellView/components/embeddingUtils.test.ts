import {
  normalizeEmbedding,
  createModelTF,
  createProjectionTF,
  normalizedToScreen,
} from './embeddingUtils.ts'

describe('normalizeEmbedding', () => {
  it('normalizes simple points to [0,1] with full percentile bounds', () => {
    const positions = new Float32Array([0, 0, 1, 0, 0, 1, 1, 1])
    const { data, bounds } = normalizeEmbedding(positions, 0, 1)
    expect(bounds.minX).toBe(0)
    expect(bounds.maxX).toBe(1)
    expect(bounds.minY).toBe(0)
    expect(bounds.maxY).toBe(1)
    // Point 0: (0,0) -> (0,0)
    expect(data[0]).toBeCloseTo(0)
    expect(data[1]).toBeCloseTo(0)
    // Point 1: (1,0) -> (1,0)
    expect(data[2]).toBeCloseTo(1)
    expect(data[3]).toBeCloseTo(0)
    // Point 3: (1,1) -> (1,1)
    expect(data[6]).toBeCloseTo(1)
    expect(data[7]).toBeCloseTo(1)
  })

  it('ignores extreme outliers using default percentile bounds', () => {
    const positions = new Float32Array([0, 0, 1, 0, 0, 1, 1, 1, 100, 100])
    const { data, bounds } = normalizeEmbedding(positions)
    // Default 1st/99th percentile bounds exclude most of the outlier influence.
    expect(bounds.maxX).toBeLessThan(100)
    expect(bounds.maxY).toBeLessThan(100)
    // The outlier (point 4) should still be mapped beyond [0,1].
    const outlierX = data[8]!
    expect(outlierX).toBeGreaterThan(1)
  })

  it('returns sensible bounds when all points are identical', () => {
    const positions = new Float32Array([5, 5, 5, 5])
    const { data, bounds } = normalizeEmbedding(positions)
    // Identical input collapses to a single point; scale fallback keeps data finite.
    expect(bounds.maxX - bounds.minX).toBe(0)
    expect(bounds.maxY - bounds.minY).toBe(0)
    expect(data[0]).toBeCloseTo(0)
    expect(data[1]).toBeCloseTo(0)
  })
})

describe('createModelTF', () => {
  it('maps [0,0] to [-1,-1] and [1,1] to [1,1]', () => {
    const m = createModelTF()
    // For a point (0,0): scale by 2 -> (0,0), translate by (-0.5,-0.5) -> (-1,-1)
    // Wait, mat3 column-major and translate applies to origin.
    // The transform is: p' = scale(2) * (p - (0.5,0.5))
    // So (0,0) -> (-1,-1), (1,1) -> (1,1).
    expect(m[0]).toBe(2)
    expect(m[4]).toBe(2)
    expect(m[6]).toBe(-1)
    expect(m[7]).toBe(-1)
  })
})

describe('createProjectionTF', () => {
  it('scales square world to fit rectangular viewport', () => {
    const p1 = createProjectionTF(800, 600)
    const p2 = createProjectionTF(600, 800)
    // Each axis is scaled by the smaller viewport dimension divided by that
    // axis size, so landscape and portrait produce different scales.
    expect(p1[0]).not.toBe(p1[4])
    expect(p2[0]).not.toBe(p2[4])
    expect(p1[0]).not.toBe(p2[0])
  })

  it('keeps scale equal on square viewport', () => {
    const p = createProjectionTF(600, 600)
    expect(p[0]).toBeCloseTo(p[4])
  })
})

describe('normalizedToScreen', () => {
  it('round-trips normalized coordinates through screen', () => {
    const width = 800
    const height = 600
    const norm: [number, number] = [0.25, 0.75]
    const screen = normalizedToScreen(norm[0], norm[1], null, width, height)
    expect(screen[0]).toBeGreaterThan(0)
    expect(screen[0]).toBeLessThan(width)
    expect(screen[1]).toBeGreaterThan(0)
    expect(screen[1]).toBeLessThan(height)
  })
})
