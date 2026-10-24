import { lazy } from 'react'

import { getConf } from '@jbrowse/core/configuration'
import { getContainingView, getSession } from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'
import { linearWiggleDisplayModelFactory } from '@jbrowse/plugin-wiggle'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const EditGCContentParamsDialog = lazy(
  () => import('./components/EditGCContentParams.tsx'),
)

type LGV = LinearGenomeViewModel

/**
 * target width in screen pixels of each GC content calculation window. the
 * adapter computes one value per window, so sizing the windows in pixels keeps
 * the number of windows in step with the width of the view, and makes the
 * resolution (bp per window) follow the zoom level
 */
const GC_CONTENT_PIXELS_PER_WINDOW = 2

/**
 * #stateModel SharedGCContentModel
 * #category display
 * extends
 * - [LinearWiggleDisplay](../linearwiggledisplay)
 */
export default function SharedModelF(
  pluginManager: PluginManager,
  configSchema: AnyConfigurationSchemaType,
) {
  return types
    .compose(
      'SharedGCContentModel',
      linearWiggleDisplayModelFactory(pluginManager, configSchema),
      types.model({
        /**
         * #property
         * manual window size in bp set by the user, undefined means "size the
         * windows from the view", see windowSizeSetting
         */
        windowSize: types.maybe(types.number),
        /**
         * #property
         */
        windowDelta: types.maybe(types.number),
      }),
    )
    .actions(self => ({
      /**
       * #action
       */
      setGCContentParams({
        windowSize,
        windowDelta,
      }: {
        windowSize?: number
        windowDelta?: number
      }) {
        self.windowSize = windowSize
        self.windowDelta = windowDelta
      },
      /**
       * #action
       * drop the manual window size and size the windows from the view again
       */
      resetGCContentParams() {
        self.windowSize = undefined
        self.windowDelta = undefined
      },
    }))
    .views(self => ({
      /**
       * #getter
       * window size in bp for the current view: one window per
       * GC_CONTENT_PIXELS_PER_WINDOW screen pixels, so the resolution grows as
       * the view zooms out and the number of windows across the view follows
       * the view width
       */
      get windowSizeFromView() {
        const view = getContainingView(self) as LGV
        return Math.max(
          1,
          Math.round(view.bpPerPx * GC_CONTENT_PIXELS_PER_WINDOW),
        )
      },
      /**
       * #getter
       * a windowSize of 0 (the default for the GC content display on the
       * reference sequence track) means the windows are sized from the view
       */
      get windowSizeSetting() {
        const windowSize =
          self.windowSize ?? (getConf(self, 'windowSize') as number)
        return windowSize > 0 ? windowSize : this.windowSizeFromView
      },
      /**
       * #getter
       */
      get windowDeltaSetting() {
        const windowDelta =
          self.windowDelta ?? (getConf(self, 'windowDelta') as number)
        return windowDelta > 0 ? windowDelta : this.windowSizeFromView
      },
    }))
    .views(self => {
      const {
        trackMenuItems: superTrackMenuItems,
        adapterProps: superAdapterProps,
      } = self
      return {
        trackMenuItems() {
          return [
            ...superTrackMenuItems(),
            {
              label: 'Change GC parameters',
              onClick: () => {
                getSession(self).queueDialog(handleClose => [
                  EditGCContentParamsDialog,
                  { model: self, handleClose },
                ])
              },
            },
          ]
        },
        /**
         * #method
         * retrieves the sequence adapter from parent track, and puts it as a
         * subadapter on a GCContentAdapter
         */
        adapterProps() {
          const sequenceAdapter = getConf(self.parentTrack, 'adapter')
          return {
            ...superAdapterProps(),
            adapterConfig: {
              type: 'GCContentAdapter',
              sequenceAdapter,
              windowSize: self.windowSizeSetting,
              windowDelta: self.windowDeltaSetting,
            },
          }
        },
      }
    })
}
