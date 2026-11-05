import PluginManager from '@jbrowse/core/PluginManager'
import LinearGenomeViewPlugin from '@jbrowse/plugin-linear-genome-view'

import {
  FEATURE_CHART_DRAWER_EXTENSION_POINT,
  clearFeatureChartDrawerCache,
  getFeatureChartDrawerMeta,
  initBuiltInDrawers,
  listFeatureChartDrawerNames,
  resolveFeatureChartDrawer,
} from './drawerRegistry.ts'
// The example plugin is a dependency-free ES module in `test_data/`, shipped so
// users have something that actually runs in jbrowse-web. Importing it here
// keeps the documentation honest: if the example stops registering, this test
// fails instead of the docs silently rotting.
// @ts-expect-error - plain JS example without types, on purpose
import SampleChartDrawersModule from '../../../../test_data/feature-chart/plugins/sampleChartDrawers.js'
import FeatureChartPlugin from '../index.ts'

import type { DrawerProps } from './types.ts'

const SampleChartDrawers = SampleChartDrawersModule as unknown as new () => {
  name: string
  install(pluginManager: PluginManager): void
  configure(): void
}

interface FakeContext {
  fillStyle: string
  globalAlpha: number
  /** Fill styles seen by each `fillRect`, in call order. */
  styles: string[]
  fillRect: jest.Mock
  arc: jest.Mock
  beginPath: jest.Mock
  fill: jest.Mock
}

function createContext(): FakeContext {
  const ctx: FakeContext = {
    fillStyle: '',
    globalAlpha: 1,
    styles: [],
    fillRect: jest.fn(),
    arc: jest.fn(),
    beginPath: jest.fn(),
    fill: jest.fn(),
  }
  ctx.fillRect.mockImplementation(() => {
    ctx.styles.push(ctx.fillStyle)
  })
  return ctx
}

function createDrawerProps(
  ctx: FakeContext,
  data: unknown,
  options?: Record<string, unknown>,
): DrawerProps {
  return {
    ctx: ctx as unknown as CanvasRenderingContext2D,
    width: 120,
    height: 180,
    data,
    name: 'GENE_A',
    region: { refName: 'ctgA', start: 1000, end: 1100, assemblyName: 'volvox' },
    bpPerPx: 1,
    feature: { get: () => undefined, id: () => 'f1' } as never,
    config: {} as never,
    theme: {} as never,
    options,
  }
}

const TISSUES = {
  tissues: {
    Brain: [35.06, 36.33, 43.78, 50.87, 51.82, 78.35],
    Liver: [6.46, 9.76, 15.41, 19.58, 26.66, 27.17],
    Heart: [5.09, 5.56, 6.93, 7.08, 7.74, 8.96],
    Kidney: [7.08, 11.87, 16.68, 21.22, 29.58, 31.73],
  },
}

function createPluginManager() {
  return new PluginManager([
    new LinearGenomeViewPlugin(),
    new FeatureChartPlugin(),
    new SampleChartDrawers(),
  ])
    .createPluggableElements()
    .configure()
}

beforeEach(() => {
  initBuiltInDrawers()
  clearFeatureChartDrawerCache()
})

describe('test_data/feature-chart/plugins/sampleChartDrawers.js', () => {
  test('registers both example drawers through the extension point', () => {
    const pluginManager = createPluginManager()
    const names = listFeatureChartDrawerNames(pluginManager)

    expect(names).toContain('samplePlugin/heatmap')
    expect(names).toContain('samplePlugin/dotPlot')

    expect(
      pluginManager.extensionPoints.has(FEATURE_CHART_DRAWER_EXTENSION_POINT),
    ).toBe(true)

    const heatmap = getFeatureChartDrawerMeta(
      'samplePlugin/heatmap',
      pluginManager,
    )
    expect(heatmap?.displayName).toBe('Sample heatmap')
    expect(heatmap?.dataShape).toBe('grouped-values')
    expect(heatmap?.optionsSchema).toEqual(
      expect.objectContaining({ colorRamp: expect.any(String) }),
    )
  })

  test('reports where it installed itself, so the worker path is checkable', () => {
    createPluginManager()
    const probe = (globalThis as { __sampleChartDrawers?: unknown })
      .__sampleChartDrawers

    expect(probe).toEqual({
      context: 'main thread',
      drawers: ['samplePlugin/heatmap', 'samplePlugin/dotPlot'],
    })
  })

  test('the heatmap drawer paints one cell per observation', () => {
    const pluginManager = createPluginManager()
    const resolution = resolveFeatureChartDrawer(
      'samplePlugin/heatmap',
      pluginManager,
    )
    if (!('drawer' in resolution)) {
      throw new Error('expected the example drawer')
    }

    const ctx = createContext()
    void resolution.drawer(createDrawerProps(ctx, TISSUES))

    // 4 tissues x 6 samples
    expect(ctx.fillRect).toHaveBeenCalledTimes(24)
    for (const [x, y, width, height] of ctx.fillRect.mock.calls as number[][]) {
      for (const value of [x, y, width, height]) {
        expect(Number.isFinite(value)).toBe(true)
      }
      expect(width).toBeGreaterThan(0)
      expect(height).toBeGreaterThan(0)
    }
  })

  test('drawerOptions change one drawer into another form', () => {
    const pluginManager = createPluginManager()
    const resolution = resolveFeatureChartDrawer(
      'samplePlugin/heatmap',
      pluginManager,
    )
    if (!('drawer' in resolution)) {
      throw new Error('expected the example drawer')
    }

    const cool = createContext()
    void resolution.drawer(
      createDrawerProps(cool, TISSUES, { colorRamp: 'cool' }),
    )
    const warm = createContext()
    void resolution.drawer(
      createDrawerProps(warm, TISSUES, { colorRamp: 'warm', cellGap: 4 }),
    )

    // every cell gets a color from the ramp, and the values differ
    expect(cool.styles).toHaveLength(24)
    for (const style of cool.styles) {
      expect(style).toMatch(/^#[0-9a-f]{6}$/i)
    }
    expect(new Set(cool.styles).size).toBeGreaterThan(1)
    // the ramp option really changes the palette
    expect(cool.styles[0]).not.toBe(warm.styles[0])

    // a larger gap shrinks the cells
    const coolWidth = (cool.fillRect.mock.calls[0] as number[])[2]!
    const warmWidth = (warm.fillRect.mock.calls[0] as number[])[2]!
    expect(warmWidth).toBeLessThan(coolWidth)
  })

  test('the dot plot drawer clamps its options', () => {
    const pluginManager = createPluginManager()
    const resolution = resolveFeatureChartDrawer(
      'samplePlugin/dotPlot',
      pluginManager,
    )
    if (!('drawer' in resolution)) {
      throw new Error('expected the example drawer')
    }

    const ctx = createContext()
    void resolution.drawer(
      createDrawerProps(ctx, TISSUES, { dotRadius: 999, jitter: 99 }),
    )

    expect(ctx.arc).toHaveBeenCalledTimes(24)
    for (const [, , radius] of ctx.arc.mock.calls as number[][]) {
      expect(radius).toBe(6)
    }
    expect(ctx.globalAlpha).toBe(1)
  })

  test('a row without the expected data shape draws nothing and does not throw', () => {
    const pluginManager = createPluginManager()
    const ctx = createContext()

    for (const drawerName of ['samplePlugin/heatmap', 'samplePlugin/dotPlot']) {
      const resolution = resolveFeatureChartDrawer(drawerName, pluginManager)
      if (!('drawer' in resolution)) {
        throw new Error(`expected ${drawerName}`)
      }
      expect(() =>
        resolution.drawer(createDrawerProps(ctx, { values: [1, 2, 3] })),
      ).not.toThrow()
    }

    expect(ctx.fillRect).not.toHaveBeenCalled()
    expect(ctx.arc).not.toHaveBeenCalled()
  })
})
