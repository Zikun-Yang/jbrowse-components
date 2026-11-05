import {
  chartModelForm,
  chartModelHash,
  datumValues,
  serializeChartModel,
} from './chartModel.ts'

import type { ChartModel } from './chartModel.ts'
import type { SummaryStats } from './statistics.ts'

const stats: SummaryStats = { min: 1, q1: 2, median: 3, q3: 4, max: 5 }

function boxModel(overrides: Partial<ChartModel> = {}): ChartModel {
  return {
    kind: 'box',
    categories: ['Brain'],
    series: [{ name: 'values', data: [{ form: 'summary-stats', stats }] }],
    style: {},
    axes: {},
    ...overrides,
  }
}

describe('serializeChartModel', () => {
  test('is stable regardless of how the object was built', () => {
    const a = boxModel()
    // same content, keys inserted in a different order
    const b = {
      axes: {},
      style: {},
      series: [{ data: [{ stats, form: 'summary-stats' }], name: 'values' }],
      categories: ['Brain'],
      kind: 'box',
    } as unknown as ChartModel
    expect(serializeChartModel(a)).toBe(serializeChartModel(b))
    expect(chartModelHash(a)).toBe(serializeChartModel(a))
  })

  test('omits unset style/axes instead of serializing undefined', () => {
    expect(serializeChartModel(boxModel())).not.toContain('undefined')
    expect(JSON.parse(serializeChartModel(boxModel()))).toEqual({
      kind: 'box',
      categories: ['Brain'],
      series: [
        {
          name: 'values',
          data: [
            {
              form: 'summary-stats',
              stats: { min: 1, q1: 2, median: 3, q3: 4, max: 5 },
            },
          ],
        },
      ],
      style: {},
      axes: {},
    })
  })

  test('every field that changes the picture changes the hash', () => {
    const base = chartModelHash(boxModel())
    const variants: ChartModel[] = [
      boxModel({ kind: 'violin' }),
      boxModel({ categories: ['Liver'] }),
      boxModel({ style: { colorScheme: 'viridis' } }),
      boxModel({ style: { bins: 12 } }),
      boxModel({ axes: { yLabel: 'TPM' } }),
      boxModel({
        series: [
          {
            name: 'values',
            data: [{ form: 'summary-stats', stats: { ...stats, median: 3.5 } }],
          },
        ],
      }),
    ]
    const hashes = new Set([base, ...variants.map(v => chartModelHash(v))])
    expect(hashes.size).toBe(variants.length + 1)
  })

  test('a stable hash means the same model hashes the same twice', () => {
    expect(chartModelHash(boxModel())).toBe(chartModelHash(boxModel()))
  })
})

describe('model helpers', () => {
  test('chartModelForm reads the datum form', () => {
    expect(chartModelForm(boxModel())).toBe('summary-stats')
    expect(
      chartModelForm(
        boxModel({ series: [{ name: 'values', data: [] }] }),
      ),
    ).toBeUndefined()
  })

  test('datumValues answers the observations a painter needs', () => {
    expect(datumValues({ form: 'grouped-values', values: [1, 2] })).toEqual([
      1, 2,
    ])
    expect(datumValues({ form: 'values', values: [3] })).toEqual([3])
    expect(datumValues({ form: 'category-values', value: 7 })).toEqual([7])
    expect(datumValues({ form: 'summary-stats', stats })).toEqual([])
  })
})
