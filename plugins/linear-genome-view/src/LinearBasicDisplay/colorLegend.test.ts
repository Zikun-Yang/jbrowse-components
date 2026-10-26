import {
  getCategoricalColorForKey,
  getContinuousHex,
  mergeFeatureColorLegendData,
} from '@jbrowse/core/util'

import {
  buildColorLegend,
  formatScoreValue,
  hasColorLegend,
} from './colorLegend.ts'

import type { ColorLegendConfig } from './colorLegend.ts'

const baseConfig: ColorLegendConfig = {
  scheme: 'default',
  scorePalette: 'viridis',
  scoreScale: 'linear',
  scoreAutoRange: true,
  scoreMin: 0,
  scoreMax: 1000,
  typePalette: 'polychrome36',
}

function config(overrides: Partial<ColorLegendConfig>): ColorLegendConfig {
  return { ...baseConfig, ...overrides }
}

describe('buildColorLegend', () => {
  test('only schemes with data-derived colors have a legend', () => {
    expect(hasColorLegend('score')).toBe(true)
    expect(hasColorLegend('type')).toBe(true)
    expect(hasColorLegend('default')).toBe(false)
    expect(hasColorLegend('featureField')).toBe(false)
    expect(hasColorLegend('strand')).toBe(false)

    expect(buildColorLegend(config({ scheme: 'default' }))).toEqual([])
    expect(buildColorLegend(config({ scheme: 'featureField' }))).toEqual([])
    expect(buildColorLegend(config({ scheme: 'strand' }))).toEqual([])
  })

  test('formats score values compactly at any magnitude', () => {
    expect(formatScoreValue(0)).toBe('0')
    expect(formatScoreValue(0.5)).toBe('0.5')
    expect(formatScoreValue(12.345)).toBe('12.3')
    expect(formatScoreValue(250)).toBe('250')
    expect(formatScoreValue(1000)).toBe('1000')
  })

  test('score legend walks the palette between the rendered min and max', () => {
    const items = buildColorLegend(config({ scheme: 'score' }), {
      min: 5,
      max: 20,
    })

    expect(items.map(i => i.label)).toEqual(['5', '8.75', '12.5', '16.3', '20'])
    expect(items.map(i => i.color)).toEqual(
      [0, 0.25, 0.5, 0.75, 1].map(t => getContinuousHex(t, 'viridis')),
    )
  })

  test('fixed range is used when scoreAutoRange is off', () => {
    const items = buildColorLegend(
      config({ scheme: 'score', scoreAutoRange: false }),
      // ranges reported by the renderer are ignored in fixed-range mode
      { min: 5, max: 20 },
    )
    expect(items.map(i => i.label)).toEqual(['0', '250', '500', '750', '1000'])
  })

  test('uses the configured palette', () => {
    const items = buildColorLegend(
      config({
        scheme: 'score',
        scoreAutoRange: false,
        scorePalette: 'plasma',
      }),
    )
    expect(items[0]!.color).toBe(getContinuousHex(0, 'plasma'))
    expect(items.at(-1)!.color).toBe(getContinuousHex(1, 'plasma'))
  })

  test('quantile legends are labelled by rank, not by invented values', () => {
    const items = buildColorLegend(
      config({ scheme: 'score', scoreScale: 'quantile' }),
      { min: 3, max: 90 },
    )
    expect(items.map(i => i.label)).toEqual(['0%', '25%', '50%', '75%', '100%'])
  })

  test('auto range without rendered scores produces no legend', () => {
    expect(buildColorLegend(config({ scheme: 'score' }))).toEqual([])
  })

  test('type legend lists the most frequent types first', () => {
    // mergeFeatureColorLegendData returns the counts in that order
    const items = buildColorLegend(config({ scheme: 'type' }), {
      typeCounts: [
        ['gene', 3],
        ['CDS', 1],
        ['exon', 1],
      ],
    })

    expect(items.map(i => i.label)).toEqual(['gene', 'CDS', 'exon'])
    expect(items[0]!.color).toBe(
      getCategoricalColorForKey('gene', 'polychrome36'),
    )
  })

  test('type legend uses the configured categorical palette', () => {
    const items = buildColorLegend(
      config({ scheme: 'type', typePalette: 'tab10' }),
      { typeCounts: [['gene', 1]] },
    )
    expect(items).toEqual([
      { color: getCategoricalColorForKey('gene', 'tab10'), label: 'gene' },
    ])
  })

  test('type legend summarizes types beyond the row cap', () => {
    const items = buildColorLegend(config({ scheme: 'type' }), {
      typeCounts: [...new Array(10).keys()].map(i => [`type${i}`, 1]),
    })

    expect(items).toHaveLength(7)
    expect(items.at(-1)).toEqual({ label: '+4 more' })
  })

  test('type legend is empty without rendered types', () => {
    expect(buildColorLegend(config({ scheme: 'type' }))).toEqual([])
  })
})

describe('mergeFeatureColorLegendData', () => {
  test('unions the score range of the blocks', () => {
    expect(
      mergeFeatureColorLegendData([
        { min: 5, max: 50 },
        undefined,
        { min: 2, max: 20 },
      ]),
    ).toEqual({ min: 2, max: 50 })
  })

  test('sums type counts across blocks, most frequent first', () => {
    expect(
      mergeFeatureColorLegendData([
        {
          typeCounts: [
            ['gene', 2],
            ['exon', 1],
          ],
        },
        {
          typeCounts: [
            ['gene', 1],
            ['CDS', 4],
          ],
        },
      ]).typeCounts,
    ).toEqual([
      ['CDS', 4],
      ['gene', 3],
      ['exon', 1],
    ])
  })

  test('ignores blocks without data', () => {
    expect(mergeFeatureColorLegendData([undefined, undefined])).toEqual({})
  })
})
