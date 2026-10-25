import {
  getCategoricalColor,
  getContinuousHex,
  valueToQuantile,
} from '@jbrowse/core/util'

import {
  computeScoreStats,
  legacyColorFeature,
  parseFeatureColorValue,
  resolveFeatureColor,
} from './colorScheme.ts'
import { getBoxColor } from './util.ts'

import type { ColorSchemeConfig } from './colorScheme.ts'
import type { Feature } from '@jbrowse/core/util'

function makeFeature(values: Record<string, unknown>): Feature {
  return {
    get: (key: string) => values[key],
  } as unknown as Feature
}

function makeScheme(
  overrides: Partial<ColorSchemeConfig> = {},
): ColorSchemeConfig {
  return {
    kind: 'default',
    colorField: 'color',
    scoreField: 'score',
    scorePalette: 'viridis',
    scoreScale: 'linear',
    scoreAutoRange: true,
    scoreMin: 0,
    scoreMax: 1000,
    typePalette: 'polychrome36',
    ...overrides,
  }
}

describe('parseFeatureColorValue', () => {
  it('converts BED r,g,b triplets to css rgb()', () => {
    expect(parseFeatureColorValue('0,0,0')).toBe('rgb(0, 0, 0)')
    expect(parseFeatureColorValue('0, 128, 255')).toBe('rgb(0, 128, 255)')
  })

  it('clamps out-of-range channel values', () => {
    expect(parseFeatureColorValue('300,-5,12')).toBe('rgb(255, 0, 12)')
  })

  it('passes through hex, functional and named colors', () => {
    expect(parseFeatureColorValue('#ff0000')).toBe('#ff0000')
    expect(parseFeatureColorValue('rgb(1, 2, 3)')).toBe('rgb(1, 2, 3)')
    expect(parseFeatureColorValue('rgba(1, 2, 3, 0.5)')).toBe(
      'rgba(1, 2, 3, 0.5)',
    )
    expect(parseFeatureColorValue('red')).toBe('red')
  })

  it('returns undefined for missing or malformed values', () => {
    expect(parseFeatureColorValue(undefined)).toBeUndefined()
    expect(parseFeatureColorValue(null)).toBeUndefined()
    expect(parseFeatureColorValue('')).toBeUndefined()
    expect(parseFeatureColorValue('1,2')).toBeUndefined()
    expect(parseFeatureColorValue('a,b,c')).toBeUndefined()
    expect(parseFeatureColorValue(42)).toBeUndefined()
  })
})

describe('computeScoreStats', () => {
  it('computes min/max/quantiles from the numeric values', () => {
    const stats = computeScoreStats(
      [
        makeFeature({ score: 10 }),
        makeFeature({ score: 30 }),
        makeFeature({ score: 20 }),
      ],
      'score',
    )!
    expect(stats.min).toBe(10)
    expect(stats.max).toBe(30)
    expect(stats.quantiles.sorted.length).toBe(3)
  })

  it('ignores missing and non-finite values', () => {
    const stats = computeScoreStats(
      [
        makeFeature({ score: 10 }),
        makeFeature({}),
        makeFeature({ score: 'not-a-number' }),
        makeFeature({ score: Number.NaN }),
      ],
      'score',
    )!
    expect(stats.min).toBe(10)
    expect(stats.max).toBe(10)
  })

  it('returns undefined when there are no numeric values', () => {
    expect(computeScoreStats([makeFeature({})], 'score')).toBeUndefined()
    expect(computeScoreStats([], 'score')).toBeUndefined()
  })
})

describe('resolveFeatureColor', () => {
  it('returns undefined for the default scheme (uses color1/color2/color3)', () => {
    expect(
      resolveFeatureColor({
        feature: makeFeature({ color: 'red' }),
        scheme: makeScheme({ kind: 'default' }),
      }),
    ).toBeUndefined()
  })

  it('reads the configured feature field', () => {
    const scheme = makeScheme({ kind: 'featureField', colorField: 'color' })
    expect(
      resolveFeatureColor({
        feature: makeFeature({ color: '10,20,30' }),
        scheme,
      }),
    ).toBe('rgb(10, 20, 30)')
    expect(
      resolveFeatureColor({
        feature: makeFeature({ itemRgb: '1,2,3' }),
        scheme: makeScheme({ kind: 'featureField', colorField: 'itemRgb' }),
      }),
    ).toBe('rgb(1, 2, 3)')
  })

  it('falls back (undefined) when the feature has no parseable color', () => {
    expect(
      resolveFeatureColor({
        feature: makeFeature({}),
        scheme: makeScheme({ kind: 'featureField' }),
      }),
    ).toBeUndefined()
    expect(
      resolveFeatureColor({
        feature: makeFeature({ color: 'not a color!!' }),
        scheme: makeScheme({ kind: 'featureField' }),
      }),
    ).toBeUndefined()
  })

  it('maps scores linearly over the auto-detected range', () => {
    const stats = computeScoreStats(
      [makeFeature({ score: 0 }), makeFeature({ score: 100 })],
      'score',
    )!
    const color = resolveFeatureColor({
      feature: makeFeature({ score: 50 }),
      scheme: makeScheme({ kind: 'score' }),
      stats,
    })
    expect(color).toBe(getContinuousHex(0.5, 'viridis'))
  })

  it('maps scores over a fixed range when auto range is disabled', () => {
    const color = resolveFeatureColor({
      feature: makeFeature({ score: 250 }),
      scheme: makeScheme({
        kind: 'score',
        scoreAutoRange: false,
        scoreMin: 0,
        scoreMax: 1000,
      }),
    })
    expect(color).toBe(getContinuousHex(0.25, 'viridis'))
  })

  it('maps scores by quantile rank when requested', () => {
    const stats = computeScoreStats(
      [
        makeFeature({ score: 10 }),
        makeFeature({ score: 20 }),
        makeFeature({ score: 30 }),
      ],
      'score',
    )!
    const expectedT = valueToQuantile(stats.quantiles, 20)
    const color = resolveFeatureColor({
      feature: makeFeature({ score: 20 }),
      scheme: makeScheme({ kind: 'score', scoreScale: 'quantile' }),
      stats,
    })
    expect(color).toBe(getContinuousHex(expectedT, 'viridis'))
  })

  it('returns undefined for a missing or non-numeric score', () => {
    expect(
      resolveFeatureColor({
        feature: makeFeature({}),
        scheme: makeScheme({ kind: 'score' }),
      }),
    ).toBeUndefined()
    expect(
      resolveFeatureColor({
        feature: makeFeature({ score: 'nope' }),
        scheme: makeScheme({ kind: 'score' }),
      }),
    ).toBeUndefined()
  })

  it('maps feature types through the categorical palette deterministically', () => {
    const scheme = makeScheme({ kind: 'type', typePalette: 'set1' })
    const a = resolveFeatureColor({
      feature: makeFeature({ type: 'gene' }),
      scheme,
    })
    const b = resolveFeatureColor({
      feature: makeFeature({ type: 'gene' }),
      scheme,
    })
    expect(a).toBeDefined()
    expect(a).toBe(b)
    // same value as picking that palette slot by index
    expect(getCategoricalColor(0, 'set1')).toBeDefined()
    expect(
      resolveFeatureColor({
        feature: makeFeature({}),
        scheme,
      }),
    ).toBeUndefined()
  })
})

describe('legacyColorFeature jexl helper', () => {
  it('prefers the normalized color field, then itemRgb, then reserved', () => {
    expect(legacyColorFeature(makeFeature({ color: 'rgb(1, 2, 3)' }))).toBe(
      'rgb(1, 2, 3)',
    )
    expect(legacyColorFeature(makeFeature({ itemRgb: '4,5,6' }))).toBe(
      'rgb(4, 5, 6)',
    )
    expect(legacyColorFeature(makeFeature({ reserved: '7,8,9' }))).toBe(
      'rgb(7, 8, 9)',
    )
  })

  it('maps bare scores on the 0-1000 BED scale', () => {
    expect(legacyColorFeature(makeFeature({ score: 500 }))).toBe(
      getContinuousHex(0.5, 'viridis'),
    )
    // the old helper clipped alpha at score/100; 2000 should now clamp to 1
    expect(legacyColorFeature(makeFeature({ score: 2000 }))).toBe(
      getContinuousHex(1, 'viridis'),
    )
  })

  it('returns gray for missing features or colors', () => {
    expect(legacyColorFeature(undefined)).toBe('gray')
    expect(legacyColorFeature(makeFeature({}))).toBe('gray')
  })
})

describe('getBoxColor strand scheme', () => {
  const config = {} as any
  const theme = {} as any
  const makeContext = () =>
    ({
      color1: { value: '#111111', isCallback: false },
      color2: { value: '#222222', isCallback: false },
      color3: { value: '#333333', isCallback: false },
      colorScheme: makeScheme({ kind: 'strand' }),
    }) as any

  it('uses color1 for +, color3 for - and color2 for unstranded', () => {
    expect(
      getBoxColor({
        feature: makeFeature({ strand: 1 }),
        config,
        configContext: makeContext(),
        theme,
      }),
    ).toBe('#111111')
    expect(
      getBoxColor({
        feature: makeFeature({ strand: -1 }),
        config,
        configContext: makeContext(),
        theme,
      }),
    ).toBe('#333333')
    expect(
      getBoxColor({
        feature: makeFeature({ strand: 0 }),
        config,
        configContext: makeContext(),
        theme,
      }),
    ).toBe('#222222')
  })
})
