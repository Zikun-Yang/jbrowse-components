import { getContainingView } from '@jbrowse/core/util'
import { addDisposer, types } from '@jbrowse/mobx-state-tree'
import { reaction } from 'mobx'

import SharedModelF from './shared.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

/**
 * bpPerPx at or below which the reference sequence display can render bases,
 * matching the point where it stops showing "Zoom in to see sequence"
 */
const SEQUENCE_ZOOM_OUT_LIMIT = 3

/**
 * #stateModel LinearGCContentDisplay
 * #category display
 * base model `SharedGCContentModel`
 */
export default function stateModelF(
  pluginManager: PluginManager,
  configSchema: AnyConfigurationSchemaType,
) {
  return types
    .compose(
      'LinearGCContentDisplay',
      SharedModelF(pluginManager, configSchema),
      types.model({
        type: types.literal('LinearGCContentDisplay'),
        /**
         * #property
         * true when the reference sequence display handed the track over
         * automatically because the view was zoomed out too far to render
         * bases (see
         * plugins/sequence/src/LinearReferenceSequenceDisplay/model.ts). only
         * then does this display hand the track back when zoomed in again: a
         * GC content display picked by hand stays put.
         */
        autoSwitchGCContent: types.maybe(types.boolean),
      }),
    )
    .actions(self => ({
      afterAttach() {
        // the mirror image of this reaction is in
        // plugins/sequence/src/LinearReferenceSequenceDisplay/model.ts
        addDisposer(
          self,
          reaction(
            () =>
              (getContainingView(self) as LGV).bpPerPx <=
                SEQUENCE_ZOOM_OUT_LIMIT && self.autoSwitchGCContent === true,
            shouldSwitch => {
              if (!shouldSwitch) {
                return
              }
              const { parentTrack } = self
              // this display type is also registered on GCContentTrack, whose
              // configurations don't have a sequence display to switch back to
              if (parentTrack.type !== 'ReferenceSequenceTrack') {
                return
              }
              const seqDisplayConf = parentTrack.configuration.displays.find(
                d => d.type === 'LinearReferenceSequenceDisplay',
              )
              if (!seqDisplayConf) {
                return
              }
              parentTrack.replaceDisplay(
                self.configuration.displayId,
                seqDisplayConf.displayId,
              )
            },
            { delay: 300, fireImmediately: true, name: 'AutoSwitchToSequence' },
          ),
        )
      },
    }))
}
