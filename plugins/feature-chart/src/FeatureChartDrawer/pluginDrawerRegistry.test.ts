import PluginManager from '@jbrowse/core/PluginManager'
import LinearGenomeViewPlugin from '@jbrowse/plugin-linear-genome-view'

import {
  FEATURE_CHART_DRAWER_EXTENSION_POINT,
  clearFeatureChartDrawerCache,
  getFeatureChartDrawer,
  getFeatureChartDrawerMeta,
  initBuiltInDrawers,
  listFeatureChartDrawerNames,
  listFeatureChartDrawers,
  resolveFeatureChartDrawer,
} from './drawerRegistry.ts'
import FeatureChartPlugin from '../index.ts'

import type { DrawerFunction } from './types.ts'
import type { PluginConstructor } from '@jbrowse/core/Plugin'

interface Contribution {
  name: string
  draw: DrawerFunction
  [field: string]: unknown
}

/** Minimal no-build style plugin: name + install + configure, no imports. */
function createDrawerPlugin(pluginName: string, contributions: Contribution[]) {
  return class FakeDrawerPlugin {
    name = pluginName
    install(pluginManager: PluginManager) {
      pluginManager.addToExtensionPoint(
        FEATURE_CHART_DRAWER_EXTENSION_POINT,
        (drawers: unknown) => [
          ...(Array.isArray(drawers) ? drawers : []),
          ...contributions,
        ],
      )
    }
    configure() {}
  }
}

const definition = {
  esmLoc: { uri: 'https://example.test/drawers/sampleChartDrawers.js' },
}

const corePlugins = (): PluginConstructor[] => [
  LinearGenomeViewPlugin,
  FeatureChartPlugin,
]

/** Main-thread assembly, same order as `createPluginManager` in jbrowse-web. */
function configureMainThread(
  runtime: { plugin: PluginConstructor; definition?: unknown }[],
) {
  return new PluginManager([
    ...corePlugins().map(plugin => ({
      plugin: new plugin(),
      metadata: { isCore: true },
    })),
    ...runtime.map(({ plugin, definition: def }) => ({
      plugin: new plugin(),
      ...(def === undefined ? {} : { definition: def }),
      metadata: {},
    })),
  ])
    .createPluggableElements()
    .configure()
}

/**
 * Worker assembly, copied from
 * `packages/product-core/src/rpcWorker.ts#getPluginManager`: core plugins and
 * runtime plugins are both mapped to instances, so the plugin manager inside
 * the RPC worker installs the same runtime plugins as the main thread.
 */
function configureWorkerPluginManager(
  loadedRuntimePlugins: PluginConstructor[],
) {
  return new PluginManager(
    [
      ...corePlugins().map(plugin => ({ plugin })),
      ...loadedRuntimePlugins.map(plugin => ({ plugin })),
    ].map(record => new record.plugin()),
  )
    .createPluggableElements()
    .configure()
}

beforeEach(() => {
  initBuiltInDrawers()
  clearFeatureChartDrawerCache()
})

describe('plugin-contributed feature chart drawers', () => {
  test('a plugin registered through Core-featureChartDrawer is visible through the plugin manager', () => {
    const draw: DrawerFunction = () => {}
    const DrawerPlugin = createDrawerPlugin('FakeDrawers', [
      { name: 'fakeDrawers/heatmap', draw },
    ])
    const pluginManager = configureMainThread([
      { plugin: DrawerPlugin, definition },
    ])

    expect(getFeatureChartDrawer('fakeDrawers/heatmap', pluginManager)).toBe(
      draw,
    )
    expect(
      listFeatureChartDrawerNames(pluginManager).filter(name =>
        name.startsWith('fakeDrawers/'),
      ),
    ).toEqual(['fakeDrawers/heatmap'])

    const resolution = resolveFeatureChartDrawer(
      'fakeDrawers/heatmap',
      pluginManager,
    )
    if (!('drawer' in resolution)) {
      throw new Error('expected a drawer')
    }
    expect(resolution.drawer).toBe(draw)
    expect(resolution.meta.name).toBe('fakeDrawers/heatmap')
    expect(resolution.meta.dataShape).toBe('any')

    // The catalog still lists the built-ins next to the contributed drawer.
    expect(listFeatureChartDrawerNames(pluginManager)).toEqual(
      expect.arrayContaining([
        'precomputedBoxPlot',
        'rawBoxPlot',
        'rawViolinPlot',
        'barPlot',
        'histogram',
      ]),
    )
  })

  test('the same plugin installed in the worker assembly order is visible there', () => {
    const draw: DrawerFunction = () => {}
    const DrawerPlugin = createDrawerPlugin('FakeDrawers', [
      { name: 'fakeDrawers/workerOnly', draw },
    ])

    const pluginManager = configureWorkerPluginManager([DrawerPlugin])

    expect(getFeatureChartDrawer('fakeDrawers/workerOnly', pluginManager)).toBe(
      draw,
    )
    expect(listFeatureChartDrawerNames(pluginManager)).toContain(
      'fakeDrawers/workerOnly',
    )
  })

  test('the main thread records the runtime plugin definition', () => {
    // The definition list is what the worker is handed on reload, so it is the
    // proxy the acceptance criteria allow for "the worker will see the plugin".
    const DrawerPlugin = createDrawerPlugin('FakeDrawers', [
      { name: 'fakeDrawers/recorded', draw: () => {} },
    ])
    const pluginManager = configureMainThread([
      { plugin: DrawerPlugin, definition },
    ])

    expect(pluginManager.runtimePluginDefinitions).toContainEqual(definition)
  })

  test('plugin drawers are invisible to the legacy module-scoped lookup', () => {
    const draw: DrawerFunction = () => {}
    const DrawerPlugin = createDrawerPlugin('FakeDrawers', [
      { name: 'fakeDrawers/scoped', draw },
    ])
    const pluginManager = configureMainThread([
      { plugin: DrawerPlugin, definition },
    ])

    // Without a plugin manager there is no way to reach the contribution: this
    // is exactly why plugin authors must not import the package to register.
    expect(getFeatureChartDrawer('fakeDrawers/scoped')).toBeUndefined()
    expect(listFeatureChartDrawerNames()).not.toContain('fakeDrawers/scoped')
    expect(getFeatureChartDrawer('fakeDrawers/scoped', pluginManager)).toBe(
      draw,
    )
  })

  test('catalog reads are cached per plugin manager until cleared', () => {
    const DrawerPlugin = createDrawerPlugin('FakeDrawers', [
      { name: 'fakeDrawers/cached', draw: () => {} },
    ])
    const pluginManager = configureMainThread([
      { plugin: DrawerPlugin, definition },
    ])

    // first read builds (and caches) the merged catalog
    expect(listFeatureChartDrawerNames(pluginManager)).toContain(
      'fakeDrawers/cached',
    )

    // a callback added after configuration is only picked up after invalidation
    pluginManager.addToExtensionPoint(
      FEATURE_CHART_DRAWER_EXTENSION_POINT,
      (drawers: unknown) => [
        ...(Array.isArray(drawers) ? drawers : []),
        { name: 'latePlugin/lateDrawer', draw: () => {} },
      ],
    )
    expect(listFeatureChartDrawerNames(pluginManager)).not.toContain(
      'latePlugin/lateDrawer',
    )

    clearFeatureChartDrawerCache(pluginManager)
    expect(listFeatureChartDrawerNames(pluginManager)).toContain(
      'latePlugin/lateDrawer',
    )

    // clearing every catalog is also predictable
    clearFeatureChartDrawerCache()
    expect(
      typeof getFeatureChartDrawer('latePlugin/lateDrawer', pluginManager),
    ).toBe('function')
  })

  test('later registration overrides an equal name and warns in development', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const replacement = jest.fn()
    const DrawerPlugin = createDrawerPlugin('OverrideDrawers', [
      { name: 'precomputedBoxPlot', draw: replacement },
    ])
    const pluginManager = configureMainThread([
      { plugin: DrawerPlugin, definition },
    ])

    expect(getFeatureChartDrawer('precomputedBoxPlot', pluginManager)).toBe(
      replacement,
    )
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('drawer "precomputedBoxPlot" was overridden'),
    )

    // the overshadowed built-in is still listed exactly once
    expect(
      listFeatureChartDrawerNames(pluginManager).filter(
        name => name === 'precomputedBoxPlot',
      ),
    ).toEqual(['precomputedBoxPlot'])

    warn.mockRestore()
  })

  test('plugins cannot erase the built-in catalog by ignoring the extendee', () => {
    class DestructivePlugin {
      name = 'DestructivePlugin'
      install(pluginManager: PluginManager) {
        // returns only its own entry, without spreading the extendee
        pluginManager.addToExtensionPoint(
          FEATURE_CHART_DRAWER_EXTENSION_POINT,
          () => [{ name: 'destructive/only', draw: () => {} }],
        )
      }
      configure() {}
    }
    const pluginManager = configureMainThread([
      { plugin: DestructivePlugin, definition },
    ])

    expect(listFeatureChartDrawerNames(pluginManager)).toEqual(
      expect.arrayContaining([
        'precomputedBoxPlot',
        'rawBoxPlot',
        'rawViolinPlot',
        'barPlot',
        'histogram',
        'destructive/only',
      ]),
    )
  })

  test('malformed contributions are skipped instead of poisoning the catalog', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    class BrokenPlugin {
      name = 'BrokenPlugin'
      install(pluginManager: PluginManager) {
        pluginManager.addToExtensionPoint(
          FEATURE_CHART_DRAWER_EXTENSION_POINT,
          (drawers: unknown) => [
            ...(Array.isArray(drawers) ? drawers : []),
            null,
            { name: '' },
            { name: 'brokenPlugin/noDraw' },
            { name: 'notNamespaced', draw: () => {} },
          ],
        )
      }
      configure() {}
    }
    const pluginManager = configureMainThread([
      { plugin: BrokenPlugin, definition },
    ])

    const names = listFeatureChartDrawerNames(pluginManager)
    expect(names).toContain('notNamespaced')
    expect(names).not.toContain('brokenPlugin/noDraw')
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('brokenPlugin/noDraw'),
    )
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('not namespaced'))
    warn.mockRestore()
  })

  test('contributed metadata is normalized, not trusted', () => {
    const MetaPlugin = createDrawerPlugin('MetaPlugin', [
      {
        name: 'metaPlugin/chart',
        displayName: 'Meta chart',
        description: 'A drawer with rich metadata.',
        dataShape: 'grouped-values',
        defaultSize: { width: 90, height: 90 },
        optionsSchema: { cellHeight: 'number' },
        draw: () => {},
      },
      {
        name: 'metaPlugin/bogusShape',
        dataShape: 'not-a-real-shape',
        draw: () => {},
      },
    ])
    const pluginManager = configureMainThread([
      { plugin: MetaPlugin, definition },
    ])

    expect(
      getFeatureChartDrawerMeta('metaPlugin/chart', pluginManager),
    ).toEqual({
      name: 'metaPlugin/chart',
      displayName: 'Meta chart',
      description: 'A drawer with rich metadata.',
      dataShape: 'grouped-values',
      defaultSize: { width: 90, height: 90 },
      optionsSchema: { cellHeight: 'number' },
    })

    // invalid dataShape values are coerced to "any" instead of leaking through
    expect(
      getFeatureChartDrawerMeta('metaPlugin/bogusShape', pluginManager)
        ?.dataShape,
    ).toBe('any')

    expect(
      listFeatureChartDrawers(pluginManager).map(meta => meta.name),
    ).toEqual(listFeatureChartDrawerNames(pluginManager))
  })
})

describe('missing plugin diagnostics', () => {
  test('a plugin-scoped name reports the plugin that is missing', () => {
    const pluginManager = configureMainThread([])

    const resolution = resolveFeatureChartDrawer(
      'notLoadedPlugin/heatmap',
      pluginManager,
    )
    if (!('error' in resolution)) {
      throw new Error('expected an error')
    }
    expect(resolution.error).toContain('notLoadedPlugin/heatmap')
    expect(resolution.missingPlugin).toBe('notLoadedPlugin')
    expect(resolution.pluginLoaded).toBe(false)
    expect(resolution.available).toContain('histogram')
  })

  test('a loaded plugin that does not provide the drawer is reported differently', () => {
    const DrawerPlugin = createDrawerPlugin('loadedPlugin', [
      { name: 'loadedPlugin/dotPlot', draw: () => {} },
    ])
    const pluginManager = configureMainThread([
      { plugin: DrawerPlugin, definition },
    ])

    const resolution = resolveFeatureChartDrawer(
      'loadedPlugin/dotplot',
      pluginManager,
    )
    if (!('error' in resolution)) {
      throw new Error('expected an error')
    }
    expect(resolution.missingPlugin).toBe('loadedPlugin')
    expect(resolution.pluginLoaded).toBe(true)
    // the drawer the plugin does provide is offered as a suggestion
    expect(resolution.suggestions).toContain('loadedPlugin/dotPlot')
  })

  test('plain typos suggest similarly named built-ins', () => {
    const pluginManager = configureMainThread([])

    const resolution = resolveFeatureChartDrawer('rawBoxplot', pluginManager)
    if (!('error' in resolution)) {
      throw new Error('expected an error')
    }
    expect(resolution.suggestions).toEqual(['rawBoxPlot'])
    expect(resolution.missingPlugin).toBeUndefined()
  })
})
