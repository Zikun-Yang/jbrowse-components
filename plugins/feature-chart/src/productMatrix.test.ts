import fs from 'node:fs'
import path from 'node:path'

import PluginManager from '@jbrowse/core/PluginManager'

import { CHART_SPEC_SCHEMA_EXTENSION_POINT } from './FeatureChartDrawer/chartSpecSchema.ts'
import {
  FEATURE_CHART_DRAWER_CATALOG_EXTENSION_POINT,
  getFeatureChartDrawer,
  initBuiltInDrawers,
} from './FeatureChartDrawer/drawerRegistry.ts'

import type { PluginConstructor } from '@jbrowse/core/Plugin'

/**
 * Product acceptance matrix — the part of "does this work in web, desktop and
 * react-app" that can be asserted without a browser.
 *
 * Each product's real `corePlugins` list is booted here, so this fails when the
 * plugin is dropped from one product, when an element type is renamed, or when
 * the extension points an agent reads stop being published. Rendering pixels,
 * the About dialog and the export buttons are covered by the plugin's own jsdom
 * tests (`renderFeatureChart`, `MaximizeDialog`, `exportChart`) and, in a browser,
 * by the manual matrix recorded on the WP5 issue.
 *
 * The products are imported dynamically: a static import of all three would pull
 * three app bundles into every unit-test run.
 */
const PRODUCTS: [
  name: string,
  load: () => Promise<{ default: PluginConstructor[] }>,
][] = [
  [
    'jbrowse-web',
    () => import('../../../products/jbrowse-web/src/corePlugins.ts'),
  ],
  [
    'jbrowse-desktop',
    () => import('../../../products/jbrowse-desktop/src/corePlugins.ts'),
  ],
  [
    'jbrowse-react-app',
    () => import('../../../products/jbrowse-react-app/src/corePlugins.ts'),
  ],
]

const repoRoot = path.resolve(__dirname, '../../..')

function configurePluginManager(plugins: PluginConstructor[]) {
  return new PluginManager(
    plugins.map(plugin => ({
      plugin: new plugin(),
      metadata: { isCore: true },
    })),
  )
    .createPluggableElements()
    .configure()
}

function readDemoConfig() {
  return JSON.parse(
    fs.readFileSync(
      path.join(repoRoot, 'test_data/feature-chart/config.json'),
      'utf8',
    ),
  ) as {
    tracks: {
      trackId: string
      type: string
      displays?: {
        type: string
        renderer?: { type: string; drawer?: string }
      }[]
    }[]
    configuration: { formatAbout?: { info?: string } }
  }
}

beforeEach(() => {
  initBuiltInDrawers()
})

describe.each(PRODUCTS)('%s', (_product, load) => {
  // one plugin manager per product, shared by the tests in this block
  let cached: Promise<PluginManager> | undefined
  const pm = () => {
    cached ??= load().then(mod => configurePluginManager(mod.default))
    return cached
  }

  test('registers every feature-chart element type', async () => {
    const manager = await pm()
    expect(manager.getTrackType('FeatureChartTrack')).toBeDefined()
    expect(manager.getDisplayType('LinearFeatureChartDisplay')).toBeDefined()
    expect(manager.getRendererType('FeatureChartRenderer')).toBeDefined()
    expect(manager.getRendererType('FeatureChartPlotlyRenderer')).toBeDefined()
    expect(manager.getAdapterType('FeatureChartTabixAdapter')).toBeDefined()
  })

  test('FeatureChartTrack is in the Add track type list', async () => {
    const manager = await pm()
    // TrackTypeSelector renders exactly `pluginManager.getTrackElements()`
    const names = manager.getTrackElements().map(element => element.name)
    expect(names).toContain('FeatureChartTrack')
  })

  test('publishes the drawer catalog and the spec vocabulary', async () => {
    const manager = await pm()
    const catalog = manager.evaluateExtensionPoint(
      FEATURE_CHART_DRAWER_CATALOG_EXTENSION_POINT,
      [],
    ) as { name: string; builtin: boolean }[]
    expect(catalog.length).toBeGreaterThanOrEqual(6)
    expect(
      catalog.filter(entry => entry.builtin).length,
    ).toBeGreaterThanOrEqual(6)
    for (const entry of catalog) {
      // a drawer an agent can choose must also be a drawer the renderer resolves
      expect(getFeatureChartDrawer(entry.name, manager)).toBeDefined()
    }

    const schema = manager.evaluateExtensionPoint(
      CHART_SPEC_SCHEMA_EXTENSION_POINT,
      null,
    ) as { kinds: string[]; kindDataForms: Record<string, string[]> }
    expect(schema).toBeTruthy()
    expect(schema.kinds).toEqual(['box', 'violin', 'bar', 'histogram'])
    expect(schema.kindDataForms.histogram).toEqual(['values'])
  })

  test('can load the demo config end to end (config entry point)', async () => {
    const manager = await pm()
    const config = readDemoConfig()
    expect(config.tracks.length).toBeGreaterThan(10)
    for (const track of config.tracks) {
      expect(manager.getTrackType(track.type)).toBeDefined()
      for (const display of track.displays ?? []) {
        expect(manager.getDisplayType(display.type)).toBeDefined()
        if (display.renderer) {
          expect(manager.getRendererType(display.renderer.type)).toBeDefined()
        }
      }
    }
    // the root `formatAbout.info` is what every About dialog falls back to
    expect(config.configuration.formatAbout?.info).toContain('feature-chart')
  })

  test('track info works for a non-feature-chart track (FeatureTrack)', async () => {
    const manager = await pm()
    // every track type extends createBaseTrackConfig, so a plain FeatureTrack
    // instance carries the track-info slots; the rendering itself is covered by
    // packages/product-core/src/ui/trackInfo.test.ts
    const featureTrack = manager.getTrackType('FeatureTrack')!
    const conf = featureTrack.configSchema.create({
      trackId: 'genes',
      name: 'Genes',
      type: 'FeatureTrack',
      assemblyNames: ['volvox'],
      adapter: { type: 'Gff3TabixAdapter', uri: 'genes.gff.gz' },
      formatAbout: { info: '**{{track.name}}** in `{{assembly.name}}`' },
    }) as any
    expect(conf.formatAbout.info.value).toBe(
      '**{{track.name}}** in `{{assembly.name}}`',
    )
    expect(conf.formatAbout.showInfo.value).toBe(true)
    expect(conf.formatAbout.hideUris.value).toBe(false)
  })
})
