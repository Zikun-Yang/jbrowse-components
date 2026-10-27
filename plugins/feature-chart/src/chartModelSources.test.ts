import {
  initBuiltInDrawers,
  registerFeatureChartDrawer,
} from './FeatureChartDrawer/drawerRegistry.ts'
import {
  chartModelForData,
  resolveTrackChartSource,
} from './chartModelSources.ts'

const data = {
  tissues: { Brain: [1, 2, 3] },
  boxes: [{ name: 'Brain', min: 1, q1: 2, median: 3, q3: 4, max: 5 }],
  bars: [{ name: 'Brain', value: 7 }],
  values: [1, 2, 3],
}

describe('resolveTrackChartSource', () => {
  beforeAll(() => {
    initBuiltInDrawers()
  })

  test('a built-in drawer resolves to its model builder', () => {
    const source = resolveTrackChartSource({
      drawer: 'rawViolinPlot',
      spec: {},
    })
    expect(source.drawerError).toBeUndefined()
    expect(source.canvasOnly).toBe(false)
    const { model } = chartModelForData(source, data)
    expect(model).toMatchObject({
      kind: 'violin',
      categories: ['Brain'],
    })
  })

  test('every built-in drawer produces a model from its own payload', () => {
    const cases: [string, unknown][] = [
      ['precomputedBoxPlot', data.boxes],
      ['rawBoxPlot', data.tissues],
      ['rawViolinPlot', data.tissues],
      ['barPlot', data.bars],
      ['histogram', data.values],
    ]
    for (const [drawer, payload] of cases) {
      const source = resolveTrackChartSource({ drawer, spec: {} })
      const { model } = chartModelForData(source, {
        boxes: payload,
        tissues: payload,
        bars: payload,
        values: payload,
      })
      expect(model?.series[0]?.data.length).toBeGreaterThan(0)
    }
  })

  test('"spec" validates once and normalizes per payload', () => {
    const spec = {
      specVersion: 1,
      kind: 'bar',
      data: { form: 'category-values', path: 'bars' },
    }
    const source = resolveTrackChartSource({ drawer: 'spec', spec })
    expect(source.specErrors).toBeUndefined()
    const { model } = chartModelForData(source, data)
    expect(model?.categories).toEqual(['Brain'])
    expect(model?.kind).toBe('bar')
  })

  test('an invalid spec is a structural error, not a model', () => {
    const source = resolveTrackChartSource({
      drawer: 'spec',
      spec: {
        specVersion: 1,
        kind: 'violin',
        data: { form: 'category-values' },
      },
    })
    expect(source.spec).toBeUndefined()
    expect(source.specErrors?.length).toBeGreaterThan(0)
  })

  test('an unknown drawer resolves to a structured error', () => {
    const source = resolveTrackChartSource({ drawer: 'nope', spec: {} })
    expect(source.drawerError?.error).toContain('Unknown FeatureChart drawer')
    expect(source.canvasOnly).toBe(false)
    expect(chartModelForData(source, data)).toEqual({})
  })

  test('a spec path that does not resolve is a per-chart error', () => {
    const source = resolveTrackChartSource({
      drawer: 'spec',
      spec: {
        specVersion: 1,
        kind: 'bar',
        data: { form: 'category-values', path: 'missing' },
      },
    })
    const { model, modelErrors } = chartModelForData(source, data)
    expect(model).toBeUndefined()
    expect(modelErrors?.[0]?.path).toBe('spec.data.path')
  })

  test('a drawer without a model builder is canvas-only', () => {
    // Registering a drawer without `buildModel` is the documented
    // canvas-only shape (a plugin that paints itself).
    registerFeatureChartDrawer('test/canvasOnly', () => {})
    const source = resolveTrackChartSource({
      drawer: 'test/canvasOnly',
      spec: {},
    })
    expect(source.canvasOnly).toBe(true)
    expect(chartModelForData(source, data)).toEqual({})
  })
})
