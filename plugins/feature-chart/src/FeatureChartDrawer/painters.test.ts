import { createDrawerProps, createRecordingContext, traceDraw } from './drawerTestHelpers.ts'
import { paintChartModel, resolveModelColorScheme } from './painters.ts'

import type { ChartModel } from './chartModel.ts'
import type { DrawerFunction } from './types.ts'

function modelOf(overrides: Partial<ChartModel>): ChartModel {
  return {
    kind: 'box',
    categories: [],
    series: [{ name: 'values', data: [] }],
    style: {},
    axes: {},
    ...overrides,
  }
}

const asDrawer = (model: ChartModel): DrawerFunction => props => {
  paintChartModel(props, model)
}

describe('painters', () => {
  test.each([
    ['box', modelOf({ kind: 'box' })],
    ['violin', modelOf({ kind: 'violin' })],
    ['bar', modelOf({ kind: 'bar' })],
    ['histogram', modelOf({ kind: 'histogram' })],
  ])('%s draws nothing at all for an empty model', (_kind, model) => {
    expect(traceDraw(asDrawer(model), undefined)).toEqual([])
  })

  test('a model with data paints a panel, axes and marks', () => {
    const model = modelOf({
      kind: 'bar',
      categories: ['Brain', 'Liver'],
      series: [
        {
          name: 'values',
          data: [
            { form: 'category-values', value: 4 },
            { form: 'category-values', value: 9 },
          ],
        },
      ],
    })
    const trace = traceDraw(asDrawer(model), undefined)
    // background panel first, marks after the axes
    expect(trace[0]).toEqual(['set:fillStyle', '#fafafa'])
    expect(trace).toContainEqual(['fillRect', 0, 0, 120, 180])
    expect(trace.filter(event => Array.isArray(event) && event[0] === 'strokeRect')).toHaveLength(2)
  })

  test('spec.style.colorScheme wins over the renderer slot', () => {
    const props = createDrawerProps(createRecordingContext(), undefined, {
      colorScheme: { name: 'renderer', colors: ['#000000'] } as never,
    })
    expect(
      resolveModelColorScheme(props, modelOf({ style: { colorScheme: 'set2' } }))
        .name,
    ).toBe('set2')
    expect(resolveModelColorScheme(props, modelOf({})).name).toBe('renderer')
  })

  test('the histogram honours style.bins', () => {
    const values = Array.from({ length: 40 }, (_, i) => i / 2)
    const counts = (bins?: number) =>
      traceDraw(
        asDrawer(
          modelOf({
            kind: 'histogram',
            series: [{ name: 'values', data: [{ form: 'values', values }] }],
            style: bins === undefined ? {} : { bins },
          }),
        ),
        undefined,
      ).filter(event => Array.isArray(event) && event[0] === 'fillRect').length

    // 10 bins by default, 16 when configured: one fillRect per non-empty bin
    expect(counts(16)).toBeGreaterThan(counts())
  })

  test('a category list longer than the data does not misalign the marks', () => {
    const model = modelOf({
      categories: ['Brain', 'Liver', 'Heart'],
      series: [
        {
          name: 'values',
          data: [
            { form: 'category-values', value: 4 },
            { form: 'category-values', value: 9 },
          ],
        },
      ],
    })
    expect(() => traceDraw(asDrawer(model), undefined)).not.toThrow()
  })
})
