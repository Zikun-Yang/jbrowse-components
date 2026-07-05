import {
  CATEGORICAL_PALETTES,
  CONTINUOUS_PALETTES,
  DEFAULT_CATEGORICAL_PALETTE,
  DEFAULT_CONTINUOUS_PALETTE,
  buildQuantileContext,
  getAllCategoricalPaletteNames,
  getAllContinuousPaletteNames,
  getCategoricalColor,
  getCategoricalColorRGB,
  getContinuousHex,
  getContinuousRGB,
  getQuantileTs,
  registerCustomCategoricalPalette,
  registerCustomContinuousPalette,
  removeCustomCategoricalPalette,
  removeCustomContinuousPalette,
  valueToQuantile,
} from './colorUtils.ts'

describe('categorical colors', () => {
  afterEach(() => {
    removeCustomCategoricalPalette('custom')
  })

  it('returns the default palette color by index', () => {
    const palette = CATEGORICAL_PALETTES[DEFAULT_CATEGORICAL_PALETTE]!
    expect(getCategoricalColor(0)).toBe(palette[0])
    expect(getCategoricalColor(palette.length - 1)).toBe(
      palette[palette.length - 1],
    )
  })

  it('wraps around when index exceeds palette length', () => {
    const palette = CATEGORICAL_PALETTES[DEFAULT_CATEGORICAL_PALETTE]!
    expect(getCategoricalColor(palette.length)).toBe(palette[0])
    expect(getCategoricalColor(palette.length + 1)).toBe(palette[1])
  })

  it('supports named palettes', () => {
    expect(getCategoricalColor(0, 'set1')).toBe(CATEGORICAL_PALETTES.set1![0])
  })

  it('returns RGB tuple in [0,1]', () => {
    const [r, g, b] = getCategoricalColorRGB(0)
    expect(r).toBeGreaterThanOrEqual(0)
    expect(r).toBeLessThanOrEqual(1)
    expect(g).toBeGreaterThanOrEqual(0)
    expect(b).toBeLessThanOrEqual(1)
  })

  it('registers and lists custom categorical palettes', () => {
    registerCustomCategoricalPalette('custom', ['#000000', '#ffffff'])
    expect(getAllCategoricalPaletteNames()).toContain('custom')
    expect(getCategoricalColor(0, 'custom')).toBe('#000000')
    expect(getCategoricalColor(1, 'custom')).toBe('#ffffff')
  })
})

describe('continuous colors', () => {
  afterEach(() => {
    removeCustomContinuousPalette('custom')
  })

  it('returns RGB values in [0,1] for default viridis', () => {
    const [r, g, b] = getContinuousRGB(0.5)
    expect(r).toBeGreaterThanOrEqual(0)
    expect(r).toBeLessThanOrEqual(1)
    expect(g).toBeGreaterThanOrEqual(0)
    expect(g).toBeLessThanOrEqual(1)
    expect(b).toBeGreaterThanOrEqual(0)
    expect(b).toBeLessThanOrEqual(1)
  })

  it('clamps values below 0 and above 1', () => {
    const low = getContinuousRGB(-0.5)
    const high = getContinuousRGB(1.5)
    const zero = getContinuousRGB(0)
    const one = getContinuousRGB(1)
    expect(low).toEqual(zero)
    expect(high).toEqual(one)
  })

  it('returns a valid hex string', () => {
    const hex = getContinuousHex(0.5)
    expect(hex).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('uses the requested palette', () => {
    const viridis = getContinuousRGB(0.5, 'viridis')
    const plasma = getContinuousRGB(0.5, 'plasma')
    expect(viridis).not.toEqual(plasma)
  })

  it('falls back to default for unknown palette names', () => {
    const fallback = getContinuousRGB(0.5, 'unknown')
    const def = getContinuousRGB(0.5, DEFAULT_CONTINUOUS_PALETTE)
    expect(fallback).toEqual(def)
  })

  it('registers and lists custom continuous palettes', () => {
    registerCustomContinuousPalette('custom', ['#000000', '#ffffff'])
    expect(getAllContinuousPaletteNames()).toContain('custom')
    const [r, g, b] = getContinuousRGB(0, 'custom')
    expect(r).toBe(0)
    expect(g).toBe(0)
    expect(b).toBe(0)
    const [r1, g1, b1] = getContinuousRGB(1, 'custom')
    expect(r1).toBe(1)
    expect(g1).toBe(1)
    expect(b1).toBe(1)
  })
})

describe('palette name helpers', () => {
  it('includes built-in categorical palettes', () => {
    expect(getAllCategoricalPaletteNames()).toContain(
      DEFAULT_CATEGORICAL_PALETTE,
    )
  })

  it('includes built-in continuous palettes', () => {
    expect(getAllContinuousPaletteNames()).toContain(DEFAULT_CONTINUOUS_PALETTE)
  })
})

describe('quantile mapping', () => {
  it('maps evenly spaced values linearly to 0..1', () => {
    const values = new Float32Array([0, 1, 2, 3, 4])
    const result = getQuantileTs(values)
    expect(result[0]).toBeCloseTo(0)
    expect(result[1]).toBeCloseTo(0.25)
    expect(result[2]).toBeCloseTo(0.5)
    expect(result[3]).toBeCloseTo(0.75)
    expect(result[4]).toBeCloseTo(1)
  })

  it('handles duplicate values', () => {
    const values = new Float32Array([1, 1, 2, 2, 3])
    const result = getQuantileTs(values)
    expect(result[0]).toBeCloseTo(0)
    expect(result[1]).toBeCloseTo(0)
    expect(result[4]).toBeCloseTo(1)
  })

  it('ignores non-finite values', () => {
    const values = new Float32Array([1, 2, NaN, Infinity, -Infinity, 3])
    const result = getQuantileTs(values)
    expect(Number.isFinite(result[0])).toBe(true)
    expect(Number.isFinite(result[1])).toBe(true)
    expect(result[2]).toBe(0)
    expect(result[3]).toBe(0)
    expect(result[4]).toBe(0)
    expect(Number.isFinite(result[5])).toBe(true)
  })

  it('returns 0.5 for a single finite value', () => {
    const ctx = buildQuantileContext(new Float32Array([42]))
    expect(valueToQuantile(ctx, 42)).toBeCloseTo(0.5)
  })

  it('returns 0 for empty context', () => {
    const ctx = buildQuantileContext(new Float32Array([]))
    expect(valueToQuantile(ctx, 1)).toBe(0)
  })
})
