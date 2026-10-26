import Plugin from '@jbrowse/core/Plugin'

import FeatureChartAdapterF from './FeatureChartAdapter/index.ts'
import { initBuiltInDrawers } from './FeatureChartDrawer/drawerRegistry.ts'
import FeatureChartPlotlyRendererF from './FeatureChartPlotlyRenderer/index.ts'
import FeatureChartRendererF from './FeatureChartRenderer/index.ts'
import FeatureChartTrackF from './FeatureChartTrack/index.ts'
import LinearFeatureChartDisplayF from './LinearFeatureChartDisplay/index.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default class FeatureChartPlugin extends Plugin {
  name = 'FeatureChartPlugin'

  install(pluginManager: PluginManager) {
    FeatureChartAdapterF(pluginManager)
    FeatureChartRendererF(pluginManager)
    FeatureChartPlotlyRendererF(pluginManager)
    LinearFeatureChartDisplayF(pluginManager)
    FeatureChartTrackF(pluginManager)
    initBuiltInDrawers()
  }
}

export {
  FEATURE_CHART_DRAWER_EXTENSION_POINT,
  clearFeatureChartDrawerCache,
  getFeatureChartDrawer,
  getFeatureChartDrawerMeta,
  initBuiltInDrawers,
  isFeatureChartDrawerResolutionError,
  listFeatureChartDrawerNames,
  listFeatureChartDrawers,
  registerFeatureChartDrawer,
  resolveFeatureChartDrawer,
} from './FeatureChartDrawer/drawerRegistry.ts'
export {
  describeFeatureChartDrawerError,
  formatFeatureChartDrawerError,
} from './FeatureChartDrawer/drawerErrors.ts'
export {
  DEFAULT_COLOR_SCHEME,
  listColorSchemeNames,
  resolveColorScheme,
} from './FeatureChartDrawer/colorSchemes.ts'
export { resolveFeatureChartRenderSettings } from './renderSettings.ts'
export type { DrawerFunction, DrawerProps } from './FeatureChartDrawer/types.ts'
export type {
  FeatureChartDrawerDataShape,
  FeatureChartDrawerMeta,
} from './FeatureChartDrawer/types.ts'
export type { FeatureChartColorScheme } from './FeatureChartDrawer/colorSchemes.ts'
export type {
  FeatureChartDrawerContribution,
  FeatureChartDrawerEntry,
  FeatureChartDrawerError,
  FeatureChartDrawerResolution,
  ResolvedFeatureChartDrawer,
} from './FeatureChartDrawer/drawerRegistry.ts'
export type {
  FeatureChartAlign,
  FeatureChartRenderSettings,
} from './renderSettings.ts'
