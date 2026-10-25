import { localStorageGetNumber, localStorageSetItem } from '@jbrowse/core/util'
import { addDisposer, types } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { IAnyStateTreeNode, Instance } from '@jbrowse/mobx-state-tree'

/**
 * default distance in px between the left edge of the view and the y-scale bar
 * of a quantitative display (wiggle, GC content, read cloud, ...). the plugins
 * that draw these bars use DEFAULT_Y_SCALEBAR_LEFT_PADDING in
 * @jbrowse/plugin-wiggle as their fallback for sessions that don't have this
 * mixin, so the two values should be kept in sync
 */
export const defaultYScaleBarLeftPadding = 10

const maxYScaleBarLeftPadding = 200

function sanitizeYScaleBarLeftPadding(n: number) {
  return Number.isFinite(n)
    ? Math.min(Math.max(0, Math.round(n)), maxYScaleBarLeftPadding)
    : defaultYScaleBarLeftPadding
}

/**
 * #stateModel YScaleBarSessionMixin
 */
export function YScaleBarSessionMixin(_pluginManager: PluginManager) {
  return types
    .model({})
    .volatile(() => ({
      yScaleBarLeftPadding: sanitizeYScaleBarLeftPadding(
        localStorageGetNumber(
          'yScaleBarLeftPadding',
          defaultYScaleBarLeftPadding,
        ),
      ),
    }))
    .actions(self => ({
      /**
       * #action
       */
      setYScaleBarLeftPadding(n: number) {
        self.yScaleBarLeftPadding = sanitizeYScaleBarLeftPadding(n)
      },
      afterAttach() {
        addDisposer(
          self,
          autorun(
            function persistYScaleBarLeftPaddingAutorun() {
              localStorageSetItem(
                'yScaleBarLeftPadding',
                String(self.yScaleBarLeftPadding),
              )
            },
            { name: 'PersistYScaleBarLeftPadding' },
          ),
        )
      },
    }))
}

/** Session mixin MST type for a session that supports the y-scale bar setting */
export type SessionWithYScaleBarType = ReturnType<typeof YScaleBarSessionMixin>

/** Instance of a session that has the y-scale bar setting */
export type SessionWithYScaleBar = Instance<SessionWithYScaleBarType>

/** Type guard for SessionWithYScaleBar */
export function isSessionWithYScaleBar(
  session: IAnyStateTreeNode,
): session is SessionWithYScaleBar {
  return 'yScaleBarLeftPadding' in session
}
