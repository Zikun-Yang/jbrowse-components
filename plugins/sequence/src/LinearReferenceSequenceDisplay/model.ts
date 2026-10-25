import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { getContainingTrack, getContainingView } from '@jbrowse/core/util'
import { getParentRenderProps } from '@jbrowse/core/util/tracks'
import { addDisposer, types } from '@jbrowse/mobx-state-tree'
import { BaseLinearDisplay } from '@jbrowse/plugin-linear-genome-view'
import { autorun, reaction } from 'mobx'

import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

/**
 * bpPerPx above which bases cannot be rendered and the display shows "Zoom in
 * to see sequence"
 */
const SEQUENCE_ZOOM_OUT_LIMIT = 3

/**
 * the LinearGCContentDisplay config of the track that contains this display, if
 * any (the gccontent plugin registers one for ReferenceSequenceTrack)
 */
function getGCContentDisplayConf(node: IAnyStateTreeNode) {
  return getContainingTrack(node).configuration.displays.find(
    d => d.type === 'LinearGCContentDisplay',
  )
}

/**
 * #stateModel LinearReferenceSequenceDisplay
 * base model `BaseLinearDisplay`
 */
export function modelFactory(configSchema: AnyConfigurationSchemaType) {
  return types
    .compose(
      'LinearReferenceSequenceDisplay',
      BaseLinearDisplay,
      types.model({
        /**
         * #property
         */
        type: types.literal('LinearReferenceSequenceDisplay'),
        /**
         * #property
         */
        configuration: ConfigurationReference(configSchema),
        /**
         * #property
         */
        showForward: true,
        /**
         * #property
         */
        showReverse: true,
        /**
         * #property
         */
        showTranslation: true,
      }),
    )
    .volatile(() => ({
      /**
       * #property
       */
      rowHeight: 15,
    }))
    .views(self => ({
      /**
       * #getter
       */
      get sequenceType() {
        return getConf(getContainingTrack(self), 'sequenceType')
      },

      /**
       * #getter
       * showReverse setting, it is NOT disabled for non-dna sequences
       */
      get showForwardActual() {
        return self.showForward
      },

      /**
       * #getter
       * showReverse setting, is disabled for non-dna sequences
       */
      get showReverseActual() {
        return this.sequenceType === 'dna' ? self.showReverse : false
      },

      /**
       * #getter
       * showTranslation setting is disabled for non-dna sequences
       */
      get showTranslationActual() {
        return this.sequenceType === 'dna' ? self.showTranslation : false
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get sequenceHeight() {
        const {
          rowHeight,
          showTranslationActual,
          showReverseActual,
          showForwardActual,
        } = self
        const r1 =
          showReverseActual && showTranslationActual ? rowHeight * 3 : 0
        const r2 =
          showForwardActual && showTranslationActual ? rowHeight * 3 : 0
        const t = r1 + r2
        const r = showReverseActual ? rowHeight : 0
        const s = showForwardActual ? rowHeight : 0
        return t + r + s
      },
    }))
    .views(self => {
      const { renderProps: superRenderProps } = self
      return {
        /**
         * #method
         */
        renderProps() {
          const {
            rpcDriverName,
            showForwardActual,
            showReverseActual,
            showTranslationActual,
            rowHeight,
            sequenceHeight,
            sequenceType,
          } = self
          return {
            ...superRenderProps(),
            ...getParentRenderProps(self),
            config: self.configuration.renderer,
            rpcDriverName,
            showForward: showForwardActual,
            showReverse: showReverseActual,
            showTranslation: showTranslationActual,
            sequenceType,
            rowHeight,
            sequenceHeight,
          }
        },
      }
    })
    .views(self => ({
      /**
       * #method
       */
      regionCannotBeRendered(/* region */) {
        const view = getContainingView(self) as LGV
        return view.bpPerPx > SEQUENCE_ZOOM_OUT_LIMIT
          ? 'Zoom in to see sequence'
          : undefined
      },
      /**
       * #getter
       */
      get rendererTypeName() {
        return self.configuration.renderer.type
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      toggleShowForward() {
        self.showForward = !self.showForward
      },
      /**
       * #action
       */
      toggleShowReverse() {
        self.showReverse = !self.showReverse
      },
      /**
       * #action
       */
      toggleShowTranslation() {
        self.showTranslation = !self.showTranslation
      },
      afterAttach() {
        addDisposer(
          self,
          autorun(
            function sequenceHeightAutorun() {
              const view = getContainingView(self) as LGV
              if (view.bpPerPx > SEQUENCE_ZOOM_OUT_LIMIT) {
                self.setHeight(50)
              } else {
                self.setHeight(self.sequenceHeight)
              }
            },
            { name: 'SequenceHeight' },
          ),
        )
        // when the view is zoomed out too far to render bases, hand the track
        // over to its GC content display (which wraps this track's sequence
        // adapter). this is always on, and the GC content display hands the
        // track back when zoomed in again, see
        // plugins/gccontent/src/LinearGCContentDisplay/stateModel1.ts
        addDisposer(
          self,
          reaction(
            () =>
              (getContainingView(self) as LGV).bpPerPx >
              SEQUENCE_ZOOM_OUT_LIMIT,
            shouldSwitch => {
              if (!shouldSwitch) {
                return
              }
              const gcDisplayConf = getGCContentDisplayConf(self)
              if (!gcDisplayConf) {
                return
              }
              // the GC content display sizes its calculation windows from the
              // view itself (see its windowSizeSetting), so it keeps a
              // sensible resolution while the user keeps zooming
              getContainingTrack(self).replaceDisplay(
                self.configuration.displayId,
                gcDisplayConf.displayId,
                { autoSwitchGCContent: true },
              )
            },
            {
              delay: 300,
              fireImmediately: true,
              name: 'AutoSwitchToGCContent',
            },
          ),
        )
      },
    }))
    .views(self => ({
      /**
       * #method
       */
      trackMenuItems() {
        return [
          ...(self.sequenceType === 'dna'
            ? [
                {
                  label: 'Show forward',
                  type: 'checkbox',
                  checked: self.showForward,
                  onClick: () => {
                    self.toggleShowForward()
                  },
                },
                {
                  label: 'Show reverse',
                  type: 'checkbox',
                  checked: self.showReverse,
                  onClick: () => {
                    self.toggleShowReverse()
                  },
                },
                {
                  label: 'Show translation',
                  type: 'checkbox',
                  checked: self.showTranslation,
                  onClick: () => {
                    self.toggleShowTranslation()
                  },
                },
              ]
            : []),
        ]
      },
    }))
    .postProcessSnapshot(snap => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!snap) {
        return snap
      }
      const { showForward, showReverse, showTranslation, ...rest } =
        snap as Omit<typeof snap, symbol>
      return {
        ...rest,
        ...(!showForward ? { showForward } : {}),
        ...(!showReverse ? { showReverse } : {}),
        ...(!showTranslation ? { showTranslation } : {}),
      } as typeof snap
    })
}
