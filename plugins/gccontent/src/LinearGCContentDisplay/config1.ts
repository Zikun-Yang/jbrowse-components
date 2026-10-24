import { ConfigurationSchema } from '@jbrowse/core/configuration'

import type PluginManager from '@jbrowse/core/PluginManager'

/**
 * #config LinearGCContentDisplay
 * #category display
 * extends LinearWiggleDisplay
 */
export default function LinearGCContentDisplay(pluginManager: PluginManager) {
  return ConfigurationSchema(
    'LinearGCContentDisplay',
    {
      /**
       * #slot
       * size in bp of the window that GC content is calculated over, or 0 to
       * size the windows from the view (one window per 2 screen pixels, so the
       * number of windows follows the view width and the resolution follows
       * the zoom level)
       */
      windowSize: {
        type: 'number',
        defaultValue: 0,
      },
      /**
       * #slot
       * step in bp between GC content windows, or 0 to match the window size
       * that is used
       */
      windowDelta: {
        type: 'number',
        defaultValue: 0,
      },
    },
    {
      /**
       * #baseConfiguration
       */
      baseConfiguration: pluginManager.getDisplayType('LinearWiggleDisplay')!
        .configSchema,
      explicitlyTyped: true,
    },
  )
}
