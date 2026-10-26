import PluginManager from '@jbrowse/core/PluginManager'
import LinearGenomeViewPlugin from '@jbrowse/plugin-linear-genome-view'

// The example plugin is a plain, dependency-free ES module shipped in
// `test_data/`; importing it here means the third-party path is covered too.
// @ts-expect-error - plain JS example without types, on purpose
import SampleChartDrawersModule from '../../../../test_data/feature-chart/plugins/sampleChartDrawers.js'
import FeatureChartPlugin from '../index.ts'
import { asDrawerData } from './drawerData.ts'
import {
  clearFeatureChartDrawerCache,
  getFeatureChartDrawer,
  initBuiltInDrawers,
  listFeatureChartDrawers,
} from './drawerRegistry.ts'
import { paintCountFor } from './drawerTestHelpers.ts'

import type { DrawerFunction } from './types.ts'

const SampleChartDrawers = SampleChartDrawersModule as unknown as new () => {
  name: string
  install(pluginManager: PluginManager): void
  configure(): void
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

/** Every drawer the renderer can reach: built-ins plus the example plugin's. */
function reachableDrawers(): { name: string; draw: DrawerFunction }[] {
  const pluginManager = createPluginManager()
  return listFeatureChartDrawers(pluginManager).map(meta => ({
    name: meta.name,
    // the catalog entry exists for every listed name, by construction
    draw: getFeatureChartDrawer(meta.name, pluginManager)!,
  }))
}

describe('asDrawerData', () => {
  test('passes plain objects through by reference', () => {
    const data = { boxes: [{ name: 'Brain' }] }
    expect(asDrawerData(data)).toBe(data)
  })

  test.each([
    ['undefined', undefined],
    ['null', null],
    ['a number', 42],
    ['a string', '{"boxes":[]}'],
    ['a boolean', true],
    ['an array', [{ name: 'Brain' }]],
  ])('substitutes {} for %s', (_label, value) => {
    expect(asDrawerData(value)).toEqual({})
  })
})

describe('drawer payload access', () => {
  beforeEach(() => {
    initBuiltInDrawers()
    clearFeatureChartDrawerCache()
  })

  test('the catalog covers the built-ins and the example plugin', () => {
    expect(reachableDrawers().map(({ name }) => name)).toEqual(
      expect.arrayContaining([
        'precomputedBoxPlot',
        'rawBoxPlot',
        'rawViolinPlot',
        'barPlot',
        'histogram',
        'samplePlugin/heatmap',
        'samplePlugin/dotPlot',
      ]),
    )
  })

  // The TSV `data` column is user input: `JSON.parse` happily yields `null`, a
  // number or a string, and a feature can arrive without a payload at all. A
  // drawer used to dereference it directly, which threw inside the canvas
  // callback and failed the *whole* track in the RPC worker.
  test.each([
    ['undefined (no contextData)', undefined],
    ['null', null],
    ['a number', 7],
    ['a string', 'nope'],
    ['a boolean', false],
    ['an array', [1, 2, 3]],
  ])(
    'every drawer paints nothing and throws nothing for %s',
    (_label, value) => {
      for (const { name, draw } of reachableDrawers()) {
        expect([name, paintCountFor(draw, value)]).toEqual([name, 0])
      }
    },
  )

  test.each([
    ['boxes with junk entries', { boxes: [null, 3, 'x', { name: 'Brain' }] }],
    ['bars with junk entries', { bars: [null, 3, { name: 'Brain' }] }],
    ['values with non-numbers', { values: [null, 'x', NaN, Infinity] }],
    ['values that is not an array', { values: 'nope', bins: 'nope' }],
    [
      'tissues with junk groups',
      { tissues: { Brain: null, Liver: 'x', Heart: [null, '1'] } },
    ],
    ['tissues that is an array', { tissues: [1, 2] }],
    ['tissues that is a string', { tissues: 'nope' }],
  ])('every drawer survives %s', (_label, value) => {
    for (const { draw } of reachableDrawers()) {
      expect(() => paintCountFor(draw, value)).not.toThrow()
    }
  })

  test('every drawer still paints the payload it declares', () => {
    const payloads: Record<string, unknown> = {
      precomputedBoxPlot: {
        boxes: [
          { name: 'Brain', min: 1, q1: 2, median: 3, q3: 4, max: 5 },
          { name: 'Liver', min: 2, q1: 3, median: 4, q3: 5, max: 6 },
        ],
      },
      rawBoxPlot: { tissues: { Brain: [1, 2, 3, 4], Liver: [2, 3, 4, 5] } },
      rawViolinPlot: { tissues: { Brain: [1, 2, 3, 4], Liver: [2, 3, 4, 5] } },
      barPlot: {
        bars: [
          { name: 'Brain', value: 42 },
          { name: 'Liver', value: 18 },
        ],
      },
      histogram: { values: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
      'samplePlugin/heatmap': {
        tissues: { Brain: [1, 2, 3], Liver: [2, 3, 4] },
      },
      'samplePlugin/dotPlot': {
        tissues: { Brain: [1, 2, 3], Liver: [2, 3, 4] },
      },
    }

    for (const { name, draw } of reachableDrawers()) {
      // a new drawer without a fixture here must fail loudly, not pass silently
      const payload = payloads[name]
      expect([name, payload !== undefined]).toEqual([name, true])
      expect([name, paintCountFor(draw, payload) > 0]).toEqual([name, true])
    }
  })
})
