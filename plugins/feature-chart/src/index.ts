import Plugin from '@jbrowse/core/Plugin'

import FeatureChartAdapterF from './FeatureChartAdapter/index.ts'
import FeatureChartRendererF from './FeatureChartRenderer/index.ts'
import LinearFeatureChartDisplayF from './LinearFeatureChartDisplay/index.ts'
import FeatureChartTrackF from './FeatureChartTrack/index.ts'
import { initBuiltInDrawers } from './FeatureChartDrawer/drawerRegistry.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default class FeatureChartPlugin extends Plugin {
  name = 'FeatureChartPlugin'

  install(pluginManager: PluginManager) {
    FeatureChartAdapterF(pluginManager)
    FeatureChartRendererF(pluginManager)
    LinearFeatureChartDisplayF(pluginManager)
    FeatureChartTrackF(pluginManager)
    initBuiltInDrawers()
  }
}

export {
  registerFeatureChartDrawer,
  getFeatureChartDrawer,
} from './FeatureChartDrawer/drawerRegistry.ts'
export type { DrawerFunction, DrawerProps } from './FeatureChartDrawer/types.ts'
