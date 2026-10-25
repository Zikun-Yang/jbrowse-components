import { lazy } from 'react'

import BaseViewModel from '@jbrowse/core/pluggableElementTypes/models/BaseViewModel'
import { avg, getSession, isSessionModelWithWidgets } from '@jbrowse/core/util'
import { ElementId } from '@jbrowse/core/util/types/mst'
import {
  addDisposer,
  addMiddleware,
  cast,
  getPath,
  types,
} from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import { FolderOpenIcon } from '@jbrowse/core/ui/Icons'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { MenuItem } from '@jbrowse/core/ui'
import type { Instance, SnapshotIn } from '@jbrowse/mobx-state-tree'
import type {
  LinearGenomeViewModel,
  LinearGenomeViewStateModel,
} from '@jbrowse/plugin-linear-genome-view'

// lazies
const ReturnToImportFormDialog = lazy(
  () => import('@jbrowse/core/ui/ReturnToImportFormDialog'),
)

/**
 * #stateModel LinearComparativeView
 * extends
 * - [BaseViewModel](../baseviewmodel)
 */
function stateModelFactory(pluginManager: PluginManager) {
  const LinearSyntenyViewHelper = pluginManager.getViewType(
    'LinearSyntenyViewHelper',
  )?.stateModel
  return types
    .compose(
      'LinearComparativeView',
      BaseViewModel,
      types.model({
        /**
         * #property
         */
        id: ElementId,
        /**
         * #property
         */
        type: types.literal('LinearComparativeView'),
        /**
         * #property
         */
        trackSelectorType: 'hierarchical',
        /**
         * #property
         */
        showIntraviewLinks: true,
        /**
         * #property
         */
        linkViews: false,
        /**
         * #property
         * when enabled, navigating in one sub-view re-centers the other
         * sub-views on the syntenically corresponding position
         */
        followSynteny: false,
        /**
         * #property
         * when followSynteny maps a window onto multiple chromosomes, keep
         * only the top chromosomes (by aligned overlap, descending) whose
         * cumulative overlap reaches this percentage of the total, filtering
         * out spurious repeat-induced hits; 100 keeps all
         */
        followCumulativePct: 90,
        /**
         * #property
         * index of the sub-view whose genome anchors rainbow (query position)
         * coloring: features in every synteny display are colored by where
         * they map onto this genome's coordinates
         */
        rainbowAnchor: 0,
        /**
         * #property
         */
        interactiveOverlay: false,
        /**
         * #property
         */
        showDynamicControls: true,
        /**
         * #property
         */
        levels: types.array(LinearSyntenyViewHelper!),
        /**
         * #property
         * currently this is limited to an array of two
         */
        views: types.array(
          pluginManager.getViewType('LinearGenomeView')!
            .stateModel as LinearGenomeViewStateModel,
        ),

        /**
         * #property
         * this represents tracks specific to this view specifically used for
         * read vs ref dotplots where this track would not really apply
         * elsewhere
         */
        viewTrackConfigs: types.array(
          pluginManager.pluggableConfigSchemaType('track'),
        ),
      }),
    )
    .volatile(() => ({
      /**
       * #volatile
       */
      width: undefined as number | undefined,
      /**
       * #volatile
       * Set to true when the view is being initialized from a launch spec to
       * avoid showing the import form during loading
       */
      isLoading: false,
      /**
       * #volatile
       * re-entrancy counter while followSynteny applies navigation to the
       * other sub-views
       */
      isFollowing: 0,
      /**
       * #volatile
       * generation counter to invalidate stale async follow applications
       */
      followSeq: 0,
      /**
       * #volatile
       * last center each sub-view was set to by followSynteny, used to
       * suppress echoes of our own navigation
       */
      lastApplied: new Map<string, { refName: string; coord: number }>(),
      /**
       * #volatile
       * the sub-view the user most recently navigated while followSynteny was
       * on; used to re-apply follow once new synteny data renders (e.g. after
       * a jump into a region whose alignments were not loaded yet)
       */
      lastNavSource: undefined as unknown,
    }))
    .views(self => ({
      /**
       * #getter
       */
      get initialized() {
        return (
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          self.width !== undefined &&
          self.views.length > 0 &&
          self.views.every(view => view.initialized)
        )
      },

      /**
       * #getter
       */
      get refNames() {
        return self.views.map(v => [
          ...new Set(v.staticBlocks.map(m => m.refName)),
        ])
      },

      /**
       * #getter
       */
      get assemblyNames() {
        return [...new Set(self.views.flatMap(v => v.assemblyNames))]
      },

      /**
       * #getter
       */
      get loadingMessage() {
        return this.showLoading ? 'Loading' : undefined
      },

      /**
       * #getter
       * Whether to show a loading indicator instead of the import form or view
       */
      get showLoading() {
        return self.isLoading || (!this.initialized && self.views.length > 0)
      },

      /**
       * #method
       * synteny-aware follow: re-center other sub-views after a navigation in
       * the given source sub-view. no-op here, overridden by
       * LinearSyntenyView
       */
      // eslint-disable-next-line @typescript-eslint/require-await
      async followFromView(_source: unknown) {
        // no-op
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      setLastNavSource(source: unknown) {
        self.lastNavSource = source
      },
    }))
    .actions(self => ({
      afterAttach() {
        addDisposer(
          self,
          addMiddleware(self, (rawCall, next) => {
            if (rawCall.type === 'action' && rawCall.id === rawCall.rootId) {
              // doesn't link showTrack/hideTrack, doesn't make sense in
              // synteny views most time
              const syncActions = [
                'horizontalScroll',
                'zoomTo',
                'setScaleFactor',
              ]

              if (self.linkViews && syncActions.includes(rawCall.name)) {
                const sourcePath = getPath(rawCall.context)
                const result = next(rawCall)
                // Sync to all other views
                for (const view of self.views) {
                  const viewPath = getPath(view)
                  if (viewPath !== sourcePath) {
                    // @ts-expect-error
                    view[rawCall.name](rawCall.args[0])
                  }
                }
                return result
              }

              const followActions = [
                'horizontalScroll',
                'zoomTo',
                'setScaleFactor',
                'moveTo',
                'centerAt',
                'navTo',
                'navToLocString',
                'showAllRegionsInAssembly',
              ]
              if (
                self.followSynteny &&
                self.isFollowing === 0 &&
                followActions.includes(rawCall.name)
              ) {
                const source = rawCall.context
                self.setLastNavSource(source)
                const result = next(rawCall) as Promise<unknown> | undefined
                if (result instanceof Promise) {
                  result
                    .then(() => self.followFromView(source))
                    .catch((e: unknown) => {
                      console.error(e)
                    })
                } else {
                  self.followFromView(source).catch((e: unknown) => {
                    console.error(e)
                  })
                }
                return result
              }
            }
            return next(rawCall)
          }),
        )
      },

      // automatically removes session assemblies associated with this view
      // e.g. read vs ref
      beforeDestroy() {
        const session = getSession(self)
        for (const name of self.assemblyNames) {
          session.removeTemporaryAssembly?.(name)
        }
      },

      /**
       * #action
       */
      setWidth(newWidth: number) {
        self.width = newWidth
      },

      /**
       * #action
       */
      setIsLoading(arg: boolean) {
        self.isLoading = arg
      },

      /**
       * #action
       */
      setViews(views: SnapshotIn<LinearGenomeViewModel>[]) {
        self.views = cast(views)
        const levels = []
        for (let i = 0; i < views.length - 1; i++) {
          levels.push({ level: i })
        }
        self.levels = cast(levels)
      },

      /**
       * #action
       */
      removeView(view: LinearGenomeViewModel) {
        self.views.remove(view)
      },

      /**
       * #action
       */
      setLevelHeight(newHeight: number, level = 0) {
        const l = self.levels[level]!
        l.setHeight(newHeight)
        return l.height
      },
      /**
       * #action
       */
      setLinkViews(arg: boolean) {
        self.linkViews = arg
        if (arg) {
          self.followSynteny = false
        }
      },
      /**
       * #action
       */
      setFollowSynteny(arg: boolean) {
        self.followSynteny = arg
        // don't snap views into alignment on toggle-on; wait for the user's
        // next navigation
        self.lastNavSource = undefined
        if (arg) {
          self.linkViews = false
        }
      },
      /**
       * #action
       */
      setFollowCumulativePct(arg: number) {
        self.followCumulativePct = Math.min(100, Math.max(1, Math.round(arg)))
      },
      /**
       * #action
       */
      setRainbowAnchor(arg: number) {
        self.rainbowAnchor = Math.max(0, Math.round(arg))
      },
      /**
       * #action
       */
      incFollowing() {
        self.isFollowing++
      },
      /**
       * #action
       */
      decFollowing() {
        self.isFollowing--
      },
      /**
       * #action
       */
      incFollowSeq() {
        return ++self.followSeq
      },
      /**
       * #action
       */
      setLastApplied(id: string, val: { refName: string; coord: number }) {
        self.lastApplied.set(id, val)
      },
      /**
       * #action
       */
      setShowDynamicControls(arg: boolean) {
        self.showDynamicControls = arg
      },
      /**
       * #action
       */
      activateTrackSelector(level: number) {
        if (self.trackSelectorType === 'hierarchical') {
          const session = getSession(self)
          if (isSessionModelWithWidgets(session)) {
            const selector = session.addWidget(
              'HierarchicalTrackSelectorWidget',
              'hierarchicalTrackSelector',
              {
                view: self.levels[level],
              },
            )
            session.showWidget(selector)
            return selector
          }
        }
        throw new Error(`invalid track selector type ${self.trackSelectorType}`)
      },

      /**
       * #action
       */
      toggleTrack(trackId: string, level = 0) {
        self.levels[level]?.toggleTrack(trackId)
      },

      /**
       * #action
       */
      showTrack(trackId: string, level = 0, initialSnapshot = {}) {
        if (!self.levels[level]) {
          self.levels[level] = cast({ level })
        }
        self.levels[level].showTrack(trackId, initialSnapshot)
      },

      /**
       * #action
       */
      hideTrack(trackId: string, level = 0) {
        self.levels[level]?.hideTrack(trackId)
      },
      /**
       * #action
       */
      squareView() {
        const average = avg(self.views.map(v => v.bpPerPx))
        for (const view of self.views) {
          const center = view.pxToBp(view.width / 2)
          view.setNewView(average, view.offsetPx)
          if (center.refName) {
            view.centerAt(center.coord, center.refName, center.index)
          }
        }
      },
      /**
       * #action
       */
      clearView() {
        self.views = cast([])
        self.levels = cast([])
      },
    }))
    .views(() => ({
      /**
       * #method
       * includes a subset of view menu options because the full list is a
       * little overwhelming. overridden by subclasses
       */
      headerMenuItems(): MenuItem[] {
        return []
      },
    }))
    .views(self => ({
      /**
       * #method
       */
      menuItems(): MenuItem[] {
        return [
          {
            label: 'Return to import form',
            onClick: () => {
              getSession(self).queueDialog(handleClose => [
                ReturnToImportFormDialog,
                {
                  model: self,
                  handleClose,
                },
              ])
            },
            icon: FolderOpenIcon,
          },
        ]
      },
      /**
       * #method
       */
      rubberBandMenuItems() {
        return [
          {
            label: 'Zoom to region(s)',
            onClick: () => {
              for (const view of self.views) {
                const { leftOffset, rightOffset } = view
                if (leftOffset && rightOffset) {
                  view.moveTo(leftOffset, rightOffset)
                }
              }
            },
          },
        ]
      },
    }))
    .actions(self => ({
      afterAttach() {
        addDisposer(
          self,
          autorun(
            function comparativeViewWidthAutorun() {
              if (self.width) {
                for (const view of self.views) {
                  view.setWidth(self.width)
                }
              }
            },
            { name: 'ComparativeViewWidth' },
          ),
        )
      },
    }))
    .preProcessSnapshot(snap => {
      // @ts-expect-error
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      const { tracks, levels = [{ tracks, level: 0 }], ...rest } = snap || {}
      return {
        ...rest,
        levels,
      }
    })
    .postProcessSnapshot(snap => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!snap) {
        return snap
      }
      const {
        trackSelectorType,
        showIntraviewLinks,
        linkViews,
        followSynteny,
        followCumulativePct,
        rainbowAnchor,
        interactiveOverlay,
        showDynamicControls,
        viewTrackConfigs,
        ...rest
      } = snap as Omit<typeof snap, symbol>
      return {
        ...rest,
        ...(trackSelectorType !== 'hierarchical' ? { trackSelectorType } : {}),
        ...(!showIntraviewLinks ? { showIntraviewLinks } : {}),
        ...(linkViews ? { linkViews } : {}),
        ...(followSynteny ? { followSynteny } : {}),
        ...(followCumulativePct !== 90 ? { followCumulativePct } : {}),
        ...(rainbowAnchor !== 0 ? { rainbowAnchor } : {}),
        ...(interactiveOverlay ? { interactiveOverlay } : {}),
        ...(!showDynamicControls ? { showDynamicControls } : {}),
        ...(viewTrackConfigs.length ? { viewTrackConfigs } : {}),
      } as typeof snap
    })
}

export type LinearComparativeViewStateModel = ReturnType<
  typeof stateModelFactory
>
export type LinearComparativeViewModel =
  Instance<LinearComparativeViewStateModel>

export default stateModelFactory
