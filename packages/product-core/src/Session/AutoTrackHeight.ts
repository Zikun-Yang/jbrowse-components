import { localStorageGetItem, localStorageSetItem } from '@jbrowse/core/util'
import { addDisposer, types } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { IAnyStateTreeNode, Instance } from '@jbrowse/mobx-state-tree'

const minAllowedTrackHeight = 20
const defaultMinAutoTrackHeight = 20
const defaultMaxAutoTrackHeight = 1000

/**
 * #stateModel AutoTrackHeightSessionMixin
 */
export function AutoTrackHeightSessionMixin(_pluginManager: PluginManager) {
  return types
    .model({})
    .volatile(() => ({
      autoSizeTrackHeight:
        localStorageGetItem('autoSizeTrackHeight') !== 'false',
      minAutoTrackHeight: Math.max(
        minAllowedTrackHeight,
        +(localStorageGetItem('minAutoTrackHeight') ||
          defaultMinAutoTrackHeight),
      ),
      maxAutoTrackHeight: Math.max(
        minAllowedTrackHeight,
        +(localStorageGetItem('maxAutoTrackHeight') ||
          defaultMaxAutoTrackHeight),
      ),
    }))
    .actions(self => ({
      /**
       * #action
       */
      setAutoSizeTrackHeight(flag: boolean) {
        self.autoSizeTrackHeight = flag
      },
      /**
       * #action
       */
      setMinAutoTrackHeight(n: number) {
        if (Number.isFinite(n)) {
          self.minAutoTrackHeight = Math.min(
            Math.max(minAllowedTrackHeight, Math.round(n)),
            self.maxAutoTrackHeight,
          )
        }
      },
      /**
       * #action
       */
      setMaxAutoTrackHeight(n: number) {
        if (Number.isFinite(n)) {
          self.maxAutoTrackHeight = Math.max(
            self.minAutoTrackHeight,
            Math.round(n),
          )
        }
      },
      afterAttach() {
        addDisposer(
          self,
          autorun(
            function persistAutoTrackHeightAutorun() {
              localStorageSetItem(
                'autoSizeTrackHeight',
                String(self.autoSizeTrackHeight),
              )
              localStorageSetItem(
                'minAutoTrackHeight',
                String(self.minAutoTrackHeight),
              )
              localStorageSetItem(
                'maxAutoTrackHeight',
                String(self.maxAutoTrackHeight),
              )
            },
            { name: 'PersistAutoTrackHeight' },
          ),
        )
      },
    }))
}

/** Session mixin MST type for a session that supports auto track heights */
export type SessionWithAutoTrackHeightType = ReturnType<
  typeof AutoTrackHeightSessionMixin
>

/** Instance of a session that has auto track height support */
export type SessionWithAutoTrackHeight = Instance<
  SessionWithAutoTrackHeightType
>

/** Type guard for SessionWithAutoTrackHeight */
export function isSessionWithAutoTrackHeight(
  session: IAnyStateTreeNode,
): session is SessionWithAutoTrackHeight {
  return 'autoSizeTrackHeight' in session
}
