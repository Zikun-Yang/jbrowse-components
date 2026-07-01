import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { createBaseTrackConfig } from '@jbrowse/core/pluggableElementTypes'
import { createBaseTrackModel } from '@jbrowse/core/pluggableElementTypes/models'
import TrackType from '@jbrowse/core/pluggableElementTypes/TrackType'

import type PluginManager from '@jbrowse/core/PluginManager'

/**
 * #config FeatureChartTrack
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

function configSchemaFactory(pluginManager: PluginManager) {
  return ConfigurationSchema(
    'FeatureChartTrack',
    {},
    {
      /**
       * #baseConfiguration
       */
      baseConfiguration: createBaseTrackConfig(pluginManager),
    },
  )
}

export default function FeatureChartTrackF(pluginManager: PluginManager) {
  pluginManager.addTrackType(() => {
    const configSchema = configSchemaFactory(pluginManager)
    const track = new TrackType({
      name: 'FeatureChartTrack',
      displayName: 'Feature chart track',
      configSchema,
      stateModel: createBaseTrackModel(
        pluginManager,
        'FeatureChartTrack',
        configSchema,
      ),
    })
    const display = pluginManager.getDisplayType('LinearFeatureChartDisplay')!
    track.addDisplayType(display)
    return track
  })
}
