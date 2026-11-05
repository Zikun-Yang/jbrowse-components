import fs from 'node:fs'
import path from 'node:path'

import PluginManager from '@jbrowse/core/PluginManager'
import LinearGenomeViewPlugin from '@jbrowse/plugin-linear-genome-view'

import {
  FEATURE_CHART_DRAWER_CATALOG_EXTENSION_POINT,
  clearFeatureChartDrawerCache,
  initBuiltInDrawers,
  listFeatureChartDrawerCatalog,
} from './FeatureChartDrawer/drawerRegistry.ts'
import {
  CHART_SPEC_SCHEMA_EXTENSION_POINT,
  chartSpecSchema,
} from './FeatureChartDrawer/chartSpecSchema.ts'
import { installFeatureChartAgentSurface } from './agentSurface.ts'
import FeatureChartPlugin from './index.ts'

import type { DrawerFunction } from './FeatureChartDrawer/types.ts'
import type { PluginConstructor } from '@jbrowse/core/Plugin'

function configure(...plugins: PluginConstructor[]) {
  return new PluginManager([
    ...[LinearGenomeViewPlugin, FeatureChartPlugin, ...plugins].map(plugin => ({
      plugin: new plugin(),
      metadata: { isCore: true },
    })),
  ])
    .createPluggableElements()
    .configure()
}

/** no-build style plugin contributing one drawer, exactly as in the dev guide */
function createDrawerPlugin(name: string, drawerName: string) {
  return class FakeDrawerPlugin {
    pluginName = name
    install(pluginManager: PluginManager) {
      pluginManager.addToExtensionPoint(
        'Core-featureChartDrawer',
        (drawers: unknown) => [
          ...(Array.isArray(drawers) ? drawers : []),
          { name: drawerName, draw: (() => {}) as DrawerFunction },
        ],
      )
    }
    configure() {}
  }
}

beforeEach(() => {
  initBuiltInDrawers()
  clearFeatureChartDrawerCache()
})

describe('chartSpecSchema', () => {
  test('restates the vocabulary validateChartSpec enforces', () => {
    const schema = chartSpecSchema()
    expect(schema.$id).toBe('jbrowse-feature-chart-spec')
    expect(schema.specVersion).toBe(1)
    expect(schema.kinds).toEqual(['box', 'violin', 'bar', 'histogram'])
    expect(schema.dataForms).toEqual([
      'summary-stats',
      'grouped-values',
      'category-values',
      'values',
    ])
    expect(schema.kindDataForms).toEqual({
      box: ['grouped-values', 'summary-stats'],
      violin: ['grouped-values'],
      bar: ['category-values'],
      histogram: ['values'],
    })
    expect(schema.bins).toEqual({ min: 1, max: 100, default: 10 })
    expect(schema.colorSchemes.length).toBeGreaterThan(0)
    const properties = schema.properties as Record<
      string,
      { enum?: unknown[] }
    >
    expect(properties.kind?.enum).toEqual(schema.kinds)
    expect(properties.data).toBeDefined()
  })

  test('is plain JSON, so it can cross the RPC/page boundary', () => {
    const schema = chartSpecSchema()
    expect(JSON.parse(JSON.stringify(schema))).toEqual(schema)
  })

  test('a returned document is a copy: mutating it cannot corrupt later calls', () => {
    const schema = chartSpecSchema()
    schema.kinds.push('box' as never)
    schema.kindDataForms.box.push('values')
    expect(chartSpecSchema().kinds).toHaveLength(4)
    expect(chartSpecSchema().kindDataForms.box).toEqual([
      'grouped-values',
      'summary-stats',
    ])
  })
})

describe('agent surface extension points', () => {
  test('the plugin publishes the drawer catalog through the PluginManager', () => {
    const pluginManager = configure()
    const catalog = pluginManager.evaluateExtensionPoint(
      FEATURE_CHART_DRAWER_CATALOG_EXTENSION_POINT,
      [],
    ) as ReturnType<typeof listFeatureChartDrawerCatalog>

    // every built-in is listed, flagged as shipped-with-the-plugin
    const names = catalog.map(entry => entry.name)
    expect(names).toEqual(
      expect.arrayContaining([
        'precomputedBoxPlot',
        'rawBoxPlot',
        'rawViolinPlot',
        'barPlot',
        'histogram',
        'spec',
      ]),
    )
    expect(catalog.every(entry => entry.builtin)).toBe(true)
    expect(names).toEqual([...names].sort())
    for (const entry of catalog) {
      expect(typeof entry.displayName).toBe('string')
      expect(typeof entry.description).toBe('string')
      expect(typeof entry.dataShape).toBe('string')
    }
  })

  test('a plugin drawer shows up in the same catalog with builtin: false', () => {
    const pluginManager = configure(createDrawerPlugin('Fake', 'fake/heatmap'))
    const catalog = pluginManager.evaluateExtensionPoint(
      FEATURE_CHART_DRAWER_CATALOG_EXTENSION_POINT,
      [],
    ) as ReturnType<typeof listFeatureChartDrawerCatalog>

    expect(catalog.find(entry => entry.name === 'fake/heatmap')).toMatchObject({
      name: 'fake/heatmap',
      builtin: false,
    })
    expect(catalog.filter(entry => entry.builtin).length).toBeGreaterThan(5)
  })

  test('a plugin that replaces a built-in name is reported as not builtin', () => {
    const pluginManager = configure(createDrawerPlugin('Fake', 'barPlot'))
    const catalog = pluginManager.evaluateExtensionPoint(
      FEATURE_CHART_DRAWER_CATALOG_EXTENSION_POINT,
      [],
    ) as ReturnType<typeof listFeatureChartDrawerCatalog>

    // the entry stays, but the implementation users get is the plugin's
    expect(catalog.filter(entry => entry.name === 'barPlot')).toHaveLength(1)
    expect(catalog.find(entry => entry.name === 'barPlot')?.builtin).toBe(false)
  })

  test('the plugin publishes the spec schema through the PluginManager', () => {
    const pluginManager = configure()
    const schema = pluginManager.evaluateExtensionPoint(
      CHART_SPEC_SCHEMA_EXTENSION_POINT,
      null,
    )
    expect(schema).toEqual(chartSpecSchema())
  })

  test('an unregistered extension point returns the accumulator, not a fake catalog', () => {
    // this is what the SDK uses to tell "plugin not loaded" from "no drawers"
    const bare = new PluginManager([]).createPluggableElements().configure()
    expect(
      bare.evaluateExtensionPoint(FEATURE_CHART_DRAWER_CATALOG_EXTENSION_POINT, []),
    ).toEqual([])
    expect(
      bare.evaluateExtensionPoint(CHART_SPEC_SCHEMA_EXTENSION_POINT, null),
    ).toBeNull()
  })

  test('installing twice does not duplicate catalog rows', () => {
    const pluginManager = configure()
    installFeatureChartAgentSurface(pluginManager)
    const first = pluginManager.evaluateExtensionPoint(
      FEATURE_CHART_DRAWER_CATALOG_EXTENSION_POINT,
      [],
    ) as [{ name: string }]
    // the second callback returns a fresh, complete list; it does not append
    expect(new Set(first.map(entry => entry.name)).size).toBe(first.length)
  })
})

describe('SPEC.md stays in sync with the generated schema', () => {
  // SPEC.md §11 prints the same JSON Schema an agent gets from
  // chartSpecSchema(). Both are derived from chartSpec.ts constants; this test is
  // the link that keeps the published doc from drifting.
  function specDocSection() {
    const file = path.resolve(__dirname, '../SPEC.md')
    const source = fs.readFileSync(file, 'utf8')
    const start = source.indexOf('## 11. Minimal JSON Schema')
    expect(start).toBeGreaterThan(-1)
    const match = /```json\n([\s\S]*?)\n```/.exec(source.slice(start))
    if (!match) {
      throw new Error('SPEC.md §11 has no json block')
    }
    return JSON.parse(match[1]!) as Record<string, unknown>
  }

  test('the documented JSON Schema equals the generated one', () => {
    const documented = specDocSection()
    const generated = chartSpecSchema()
    // $id and the convenience tables are additions of the generated document;
    // everything that is JSON Schema must match the doc byte for byte
    const shared = [
      '$schema',
      'title',
      'type',
      'required',
      'additionalProperties',
      'properties',
      'allOf',
    ]
    for (const key of shared) {
      expect({ [key]: generated[key as keyof typeof generated] }).toEqual({
        [key]: documented[key],
      })
    }
  })

  test('the doc block does not claim keys the generator does not have', () => {
    const documented = specDocSection()
    const schemaKeys = Object.keys(chartSpecSchema())
    for (const key of Object.keys(documented)) {
      expect(schemaKeys).toContain(key)
    }
  })
})
