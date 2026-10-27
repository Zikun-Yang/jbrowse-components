import { boxModelFromPrecomputed } from './FeatureChartDrawer/boxPlot.ts'
import {
  initBuiltInDrawers,
  resolveFeatureChartDrawer,
} from './FeatureChartDrawer/drawerRegistry.ts'
import {
  chartCacheKey,
  chartCanvasBytes,
  chartRenderCacheStats,
  clearChartRenderCache,
  colorSchemeHash,
  createChartCanvas,
  drawerSignature,
  getCachedChartCanvas,
  hashString,
  stableStringify,
  storeChartCanvas,
} from './renderCache.ts'

const model = boxModelFromPrecomputed({
  boxes: [{ name: 'Brain', min: 1, q1: 2, median: 3, q3: 4, max: 5 }],
})

function key(overrides: Partial<Parameters<typeof chartCacheKey>[0]> = {}) {
  return chartCacheKey({
    featureId: 'f1',
    model,
    width: 120,
    height: 180,
    dpr: 2,
    themeHash: 'light',
    drawerSignature: 'precomputedBoxPlot|{}',
    ...overrides,
  })
}

describe('render cache keys', () => {
  test('are stable for identical inputs', () => {
    expect(key()).toBe(key())
  })

  test.each([
    ['featureId', { featureId: 'f2' }],
    ['width', { width: 130 }],
    ['height', { height: 190 }],
    ['dpr', { dpr: 1 }],
    ['theme', { themeHash: 'dark' }],
    ['drawer options', { drawerSignature: 'precomputedBoxPlot|{"x":1}' }],
  ])('change when %s changes', (_label, overrides) => {
    expect(key(overrides)).not.toBe(key())
  })

  test('change when the model changes (payload → hash)', () => {
    const other = boxModelFromPrecomputed({
      boxes: [{ name: 'Brain', min: 1, q1: 2, median: 3.5, q3: 4, max: 5 }],
    })
    expect(key({ model: other })).not.toBe(key())
  })

  test('every visible model field changes the hash', () => {
    const labelled: typeof model = {
      ...model,
      axes: { ...model.axes, yLabel: 'TPM' },
    }
    expect(key({ model: labelled })).not.toBe(key())
  })
})

describe('drawerSignature', () => {
  test('is key-order independent and includes the drawer name', () => {
    expect(drawerSignature('barPlot', { b: 1, a: 2 })).toBe(
      drawerSignature('barPlot', { a: 2, b: 1 }),
    )
    expect(drawerSignature('barPlot', {})).not.toBe(
      drawerSignature('histogram', {}),
    )
  })

  test('stableStringify handles arrays, nesting and nulls', () => {
    expect(stableStringify({ b: [1, null, { d: 2, c: 3 }], a: 'x' })).toBe(
      '{"a":"x","b":[1,null,{"c":3,"d":2}]}',
    )
  })
})

describe('chart canvas cache', () => {
  beforeEach(() => {
    clearChartRenderCache()
  })

  test('creates offscreen canvases only when the runtime supports them', () => {
    // jsdom has no OffscreenCanvas: the cache layer must decline, not throw.
    expect(createChartCanvas(120, 180)).toBeUndefined()
  })

  test('stores, hits and reports stats', () => {
    const canvas = { width: 240, height: 360 } as never
    storeChartCanvas('a', canvas, chartCanvasBytes(120, 180, 2))
    expect(getCachedChartCanvas('a')).toBe(canvas)
    expect(getCachedChartCanvas('missing')).toBeUndefined()

    const stats = chartRenderCacheStats()
    expect(stats).toMatchObject({ entries: 1, hits: 1, misses: 1 })
    expect(stats.bytes).toBe(240 * 360 * 4)
  })

  test('clear() empties the cache', () => {
    storeChartCanvas('a', {} as never, 10)
    clearChartRenderCache()
    expect(chartRenderCacheStats().entries).toBe(0)
    expect(getCachedChartCanvas('a')).toBeUndefined()
  })
})

describe('hashing', () => {
  test('hashString is deterministic and differs for different models', () => {
    expect(hashString('abc')).toBe(hashString('abc'))
    expect(hashString('abc')).not.toBe(hashString('abd'))
  })

  test('colorSchemeHash covers palette and theme surfaces', () => {
    const light = {
      name: 'tableau10',
      colors: ['#000000', '#111111'],
      background: '#fff',
      grid: '#eee',
      axis: '#333',
      text: '#000',
      muted: '#999',
    }
    expect(colorSchemeHash(light)).toBe(colorSchemeHash({ ...light }))
    expect(colorSchemeHash(light)).not.toBe(
      colorSchemeHash({ ...light, background: '#000' }),
    )
    expect(colorSchemeHash(light)).not.toBe(
      colorSchemeHash({ ...light, colors: ['#111111', '#000000'] }),
    )
  })
})

describe('built-in drawers expose a model builder', () => {
  test('all five built-ins can build a ChartModel (Plotly needs it)', () => {
    initBuiltInDrawers()
    // Resolved through the registry → the same path `resolveTrackChartSource`
    // uses. A drawer without `buildModel` is canvas-only, which for a built-in
    // would silently disable the interactive backend.
    for (const name of [
      'precomputedBoxPlot',
      'rawBoxPlot',
      'rawViolinPlot',
      'barPlot',
      'histogram',
    ]) {
      const resolution = resolveFeatureChartDrawer(name)
      expect('drawer' in resolution && resolution.buildModel).toBeTruthy()
    }
  })
})
