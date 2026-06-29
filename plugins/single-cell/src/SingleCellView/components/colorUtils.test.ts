import {
  CATEGORICAL_PALETTES,
  CONTINUOUS_PALETTES,
  DEFAULT_CATEGORICAL_PALETTE,
  DEFAULT_CONTINUOUS_PALETTE,
  getAllCategoricalPaletteNames,
  getAllContinuousPaletteNames,
  getCategoricalColor,
  getCategoricalColorRGB,
  getContinuousHex,
  getContinuousRGB,
  registerCustomCategoricalPalette,
  registerCustomContinuousPalette,
  removeCustomCategoricalPalette,
  removeCustomContinuousPalette,
} from './colorUtils.ts'

describe('categorical colors', () => {
  afterEach(() => {
    removeCustomCategoricalPalette('custom')
  })

  it('returns the default tab10 palette color by index', () => {
    expect(getCategoricalColor(0)).toBe(CATEGORICAL_PALETTES.tab10![0])
    expect(getCategoricalColor(9)).toBe(CATEGORICAL_PALETTES.tab10![9])
  })

  it('wraps around when index exceeds palette length', () => {
    const palette = CATEGORICAL_PALETTES.tab10!
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
    expect(getAllCategoricalPaletteNames()).toContain(DEFAULT_CATEGORICAL_PALETTE)
  })

  it('includes built-in continuous palettes', () => {
    expect(getAllContinuousPaletteNames()).toContain(DEFAULT_CONTINUOUS_PALETTE)
  })
})
