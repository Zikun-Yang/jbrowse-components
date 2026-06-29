import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { createBaseTrackConfig } from '@jbrowse/core/pluggableElementTypes'
import { createBaseTrackModel } from '@jbrowse/core/pluggableElementTypes/models'
import TrackType from '@jbrowse/core/pluggableElementTypes/TrackType'

import type PluginManager from '@jbrowse/core/PluginManager'

/**
 * #config SingleCellAlignmentsTrack
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

function configSchemaFactory(pluginManager: PluginManager) {
  return ConfigurationSchema(
    'SingleCellAlignmentsTrack',
    {},
    {
      /**
       * #baseConfiguration
       */
      baseConfiguration: createBaseTrackConfig(pluginManager),
    },
  )
}

export default function SingleCellAlignmentsTrackF(pluginManager: PluginManager) {
  pluginManager.addTrackType(() => {
    const configSchema = configSchemaFactory(pluginManager)
    const track = new TrackType({
      name: 'SingleCellAlignmentsTrack',
      displayName: 'Single-cell alignments track',
      configSchema,
      stateModel: createBaseTrackModel(
        pluginManager,
        'SingleCellAlignmentsTrack',
        configSchema,
      ),
    })
    const pileupDisplay = pluginManager.getDisplayType('SingleCellPileupDisplay')!
    const snpCoverageDisplay = pluginManager.getDisplayType(
      'SingleCellSNPCoverageDisplay',
    )!
    track.addDisplayType(pileupDisplay)
    track.addDisplayType(snpCoverageDisplay)
    return track
  })
}
