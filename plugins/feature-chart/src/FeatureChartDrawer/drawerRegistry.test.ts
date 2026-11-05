import {
  getFeatureChartDrawer,
  getFeatureChartDrawerMeta,
  initBuiltInDrawers,
  listFeatureChartDrawerNames,
  listFeatureChartDrawers,
  registerFeatureChartDrawer,
  resolveFeatureChartDrawer,
} from './drawerRegistry.ts'

const BUILT_IN_NAMES = [
  'barPlot',
  'histogram',
  'precomputedBoxPlot',
  'rawBoxPlot',
  'rawViolinPlot',
  'spec',
].sort()

const DATA_SHAPES = [
  'summary-stats',
  'grouped-values',
  'category-values',
  'values',
  'any',
]

describe('feature chart drawer catalog', () => {
  beforeEach(() => {
    initBuiltInDrawers()
  })

  test('every built-in drawer exposes complete metadata', () => {
    const catalog = listFeatureChartDrawers()

    expect(listFeatureChartDrawerNames()).toEqual(BUILT_IN_NAMES)

    for (const meta of catalog) {
      expect(typeof meta.name).toBe('string')
      expect(meta.name.length).toBeGreaterThan(0)
      expect(typeof meta.displayName).toBe('string')
      expect(meta.displayName.length).toBeGreaterThan(0)
      expect(typeof meta.description).toBe('string')
      // one sentence, not a one-word placeholder
      expect(meta.description.length).toBeGreaterThan(20)
      expect(DATA_SHAPES).toContain(meta.dataShape)
      expect(meta.defaultSize).toEqual({ width: 120, height: 180 })
      const resolution = resolveFeatureChartDrawer(meta.name)
      expect('drawer' in resolution).toBe(true)
      if ('drawer' in resolution) {
        expect(getFeatureChartDrawer(meta.name)).toBe(resolution.drawer)
      }
    }
  })

  test('catalog is sorted by name and stable across calls', () => {
    const first = listFeatureChartDrawers().map(meta => meta.name)
    const second = listFeatureChartDrawers().map(meta => meta.name)

    expect(first).toEqual([...first].sort())
    expect(second).toEqual(first)
  })

  test('catalog stays sorted after registering a third-party drawer', () => {
    registerFeatureChartDrawer('aaaCustom', () => {}, {
      displayName: 'Custom',
      description: 'A custom drawer used to prove catalog ordering.',
      dataShape: 'any',
    })

    const names = listFeatureChartDrawerNames()
    expect(names[0]).toBe('aaaCustom')
    expect(names).toEqual([...names].sort())
  })

  test('legacy two-argument registration still works and gets filler meta', () => {
    const draw = () => {}
    registerFeatureChartDrawer('legacyDrawer', draw)

    expect(getFeatureChartDrawer('legacyDrawer')).toBe(draw)

    const meta = getFeatureChartDrawerMeta('legacyDrawer')
    expect(meta).toMatchObject({
      name: 'legacyDrawer',
      displayName: 'legacyDrawer',
      dataShape: 'any',
    })
    expect(meta?.description).toContain('legacyDrawer')

    // still resolvable for renderers written against the new contract
    const resolution = resolveFeatureChartDrawer('legacyDrawer')
    expect('drawer' in resolution && resolution.drawer).toBe(draw)
  })
})

describe('resolveFeatureChartDrawer', () => {
  beforeEach(() => {
    initBuiltInDrawers()
  })

  test('returns the drawer and its meta for a known name', () => {
    const resolution = resolveFeatureChartDrawer('rawBoxPlot')
    if (!('drawer' in resolution)) {
      throw new Error('expected a drawer')
    }
    expect(resolution.meta.name).toBe('rawBoxPlot')
    expect(resolution.meta.dataShape).toBe('grouped-values')
  })

  test('returns an error plus available names for an unknown drawer', () => {
    const resolution = resolveFeatureChartDrawer('tissueBoxPlot')

    expect('drawer' in resolution).toBe(false)
    if (!('error' in resolution)) {
      throw new Error('expected an error')
    }
    expect(resolution.error).toContain('tissueBoxPlot')
    expect(resolution.available).toEqual(
      expect.arrayContaining(['precomputedBoxPlot', 'rawBoxPlot']),
    )
    expect(resolution.available).not.toContain('tissueBoxPlot')
  })

  test('treats an empty drawer name as missing instead of unknown', () => {
    const resolution = resolveFeatureChartDrawer(undefined)

    if (!('error' in resolution)) {
      throw new Error('expected an error')
    }
    expect(resolution.error).toMatch(/No FeatureChart drawer configured/)
    expect(resolution.available.length).toBeGreaterThan(0)
  })
})
