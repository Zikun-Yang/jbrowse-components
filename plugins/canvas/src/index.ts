import Plugin from '@jbrowse/core/Plugin'

import { legacyColorFeature } from './CanvasFeatureRenderer/colorScheme.ts'
import CanvasFeatureRendererF from './CanvasFeatureRenderer/index.ts'
import registerGlyphs from './glyphs/index.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default class CanvasPlugin extends Plugin {
  name = 'CanvasPlugin'

  install(pluginManager: PluginManager) {
    registerGlyphs(pluginManager)
    CanvasFeatureRendererF(pluginManager)

    // deprecated: kept so configs that still use `jexl:colorFeature(feature)`
    // keep working. Prefer the native renderer `colorScheme` config; this is
    // registered here (not in an app-level plugin file) so every product that
    // loads the canvas plugin gets the same behavior.
    pluginManager.jexl.addFunction('colorFeature', legacyColorFeature)
  }
}
