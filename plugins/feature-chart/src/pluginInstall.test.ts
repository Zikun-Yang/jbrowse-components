import PluginManager from '@jbrowse/core/PluginManager'
import LinearGenomeViewPlugin from '@jbrowse/plugin-linear-genome-view'

import { listFeatureChartDrawerNames } from './FeatureChartDrawer/drawerRegistry.ts'
import FeatureChartPlugin from './index.ts'

/**
 * Smoke test for "the plugin is actually wired into a product": a real
 * PluginManager install must expose the track, display, renderers and adapter,
 * and must populate the built-in drawer catalog (install calls
 * `initBuiltInDrawers()`).
 */
function createPluginManager() {
  const pluginManager = new PluginManager([
    new LinearGenomeViewPlugin(),
    new FeatureChartPlugin(),
  ])
  pluginManager.createPluggableElements()
  pluginManager.configure()
  return pluginManager
}

describe('FeatureChartPlugin install', () => {
  test('registers every pluggable element', () => {
    const pluginManager = createPluginManager()

    expect(pluginManager.getTrackType('FeatureChartTrack')?.name).toBe(
      'FeatureChartTrack',
    )
    expect(
      pluginManager.getDisplayType('LinearFeatureChartDisplay')?.name,
    ).toBe('LinearFeatureChartDisplay')
    expect(pluginManager.getRendererType('FeatureChartRenderer')?.name).toBe(
      'FeatureChartRenderer',
    )
    expect(
      pluginManager.getRendererType('FeatureChartPlotlyRenderer')?.name,
    ).toBe('FeatureChartPlotlyRenderer')
    expect(pluginManager.getAdapterType('FeatureChartTabixAdapter')?.name).toBe(
      'FeatureChartTabixAdapter',
    )
  })

  test('populates the drawer catalog on install', () => {
    createPluginManager()

    expect(listFeatureChartDrawerNames()).toEqual([
      'barPlot',
      'histogram',
      'precomputedBoxPlot',
      'rawBoxPlot',
      'rawViolinPlot',
    ])
  })
})
