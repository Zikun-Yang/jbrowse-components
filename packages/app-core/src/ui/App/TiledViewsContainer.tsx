import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'
import { useTheme } from '@mui/material'
import { DockviewReact } from 'dockview-react'
import { autorun } from 'mobx'
import { observer } from 'mobx-react'

import {
  DockviewContext,
  clearPendingMoveAction,
  peekPendingMoveAction,
} from './DockviewContext.tsx'
import JBrowseViewPanel from './JBrowseViewPanel.tsx'
import {
  addPanelForView,
  cleanLayoutForStorage,
  updatePanelParams,
} from './dockviewUtils.ts'
import { isSessionWithDockviewLayout } from '../../DockviewLayout/index.ts'

import type { DockviewSessionType } from './types.ts'
import type {
  DockviewApi,
  DockviewGroupPanel,
  DockviewReadyEvent,
} from 'dockview-react'

const useStyles = makeStyles()(theme => ({
  container: {
    height: '100%',
    width: '100%',
    gridRow: 'components',
  },
  noTabs: {
    '& .dockview-theme-light, & .dockview-theme-dark': {
      '--dv-group-view-background-color': 'transparent',
      '--dv-tabs-and-actions-container-background-color': 'transparent',
      '--dv-tabs-and-actions-container-height': '0px',
      '--dv-tab-divider-color': 'transparent',
    },
    '& .dv-groupview': {
      border: 'none',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
    },
    '& .dv-tabs-and-actions-container': {
      display: 'none',
    },
    '& .dv-content-container': {
      backgroundColor: 'transparent',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
    },
    '& .dv-sash': {
      backgroundColor: 'transparent',
      '&:hover, &.dv-active-sash': {
        backgroundColor: theme.palette.divider,
      },
    },
  },
}))

interface Props {
  session: DockviewSessionType
}

const components = {
  jbrowseView: JBrowseViewPanel,
}

const TiledViewsContainer = observer(function TiledViewsContainer({
  session,
}: Props) {
  const { classes, cx } = useStyles()
  const theme = useTheme()
  const [api, setApi] = useState<DockviewApi | null>(null)
  const trackedViewIdsRef = useRef(new Set<string>())
  const rearrangingRef = useRef(false)
  const sessionRef = useRef(session)
  sessionRef.current = session

  const rearrangePanels = useCallback(
    (arrange: (api: DockviewApi) => void) => {
      if (!api) {
        return
      }
      rearrangingRef.current = true
      try {
        arrange(api)
      } finally {
        rearrangingRef.current = false
      }
    },
    [api],
  )

  const moveViewToPanel = useCallback(
    (viewId: string, direction?: 'right') => {
      if (!api || !isSessionWithDockviewLayout(session)) {
        return
      }

      // Remove view from its current panel and close the now-empty panel
      const oldPanelId = session.getPanelIdForView(viewId)
      session.removeViewFromPanel(viewId)
      if (oldPanelId) {
        const oldPanel = api.getPanel(oldPanelId)
        if (oldPanel) {
          api.removePanel(oldPanel)
        }
      }

      // Create a new panel for the view
      const { panelId } = addPanelForView(api, session, viewId, {
        referenceGroup: api.activeGroup ?? undefined,
        direction,
      })
      session.assignViewToPanel(panelId, viewId)
      session.setActivePanelId(panelId)
    },
    [api, session],
  )

  const moveViewToSplitRight = useCallback(
    (viewId: string) => {
      moveViewToPanel(viewId, 'right')
    },
    [moveViewToPanel],
  )

  const contextValue = useMemo(
    () => ({
      api,
      rearrangePanels,
      moveViewToSplitRight,
    }),
    [api, rearrangePanels, moveViewToSplitRight],
  )

  const createInitialPanels = useCallback((dockviewApi: DockviewApi) => {
    const session = sessionRef.current

    // Clear any stale state from previous mounts (e.g. React StrictMode double-mounting)
    if (isSessionWithDockviewLayout(session)) {
      for (const panelId of session.panelViewAssignments.keys()) {
        session.removePanel(panelId)
      }
      session.setDockviewLayout(undefined)
    }
    trackedViewIdsRef.current.clear()

    // Nothing to show -> leave workspace empty
    if (session.views.length === 0) {
      return
    }

    const pendingAction = peekPendingMoveAction()
    const pendingViewExists =
      pendingAction && session.views.some(v => v.id === pendingAction.viewId)

    // Create one independent panel per view, splitting to the right
    const createPanelsForViews = (
      viewIds: string[],
      options?: { activeViewId?: string },
    ) => {
      let activeGroup: DockviewGroupPanel | undefined
      for (const viewId of viewIds) {
        const { panelId, group } = addPanelForView(dockviewApi, session, viewId, {
          referenceGroup: activeGroup,
          direction: 'right',
        })
        activeGroup = group
        if (isSessionWithDockviewLayout(session)) {
          session.assignViewToPanel(panelId, viewId)
        }
        trackedViewIdsRef.current.add(viewId)

        if (options?.activeViewId === viewId) {
          session.setActivePanelId(panelId)
          dockviewApi.getPanel(panelId)?.api.setActive()
        }
      }
      if (!options?.activeViewId && activeGroup) {
        const firstPanel = activeGroup.panels[0]
        if (firstPanel && isSessionWithDockviewLayout(session)) {
          session.setActivePanelId(firstPanel.id)
          firstPanel.api.setActive()
        }
      }
    }

    if (pendingViewExists && isSessionWithDockviewLayout(session) && pendingAction) {
      const { viewId: pendingViewId } = pendingAction
      const otherViewIds = session.views
        .map(v => v.id)
        .filter(id => id !== pendingViewId)

      createPanelsForViews(otherViewIds)

      // Move pending view to a new split on the right
      const { panelId: pendingPanelId } = addPanelForView(
        dockviewApi,
        session,
        pendingViewId,
        {
          referenceGroup: dockviewApi.activeGroup ?? undefined,
          direction: 'right',
        },
      )
      session.assignViewToPanel(pendingPanelId, pendingViewId)
      trackedViewIdsRef.current.add(pendingViewId)
      session.setActivePanelId(pendingPanelId)
      dockviewApi.getPanel(pendingPanelId)?.api.setActive()

      clearPendingMoveAction()
      return
    }

    createPanelsForViews(session.views.map(v => v.id))
  }, [])

  const onReady = useCallback(
    (event: DockviewReadyEvent) => {
      setApi(event.api)

      event.api.onDidActivePanelChange(e => {
        if (e?.id && isSessionWithDockviewLayout(sessionRef.current)) {
          sessionRef.current.setActivePanelId(e.id)
        }
      })

      event.api.onDidRemovePanel(e => {
        if (rearrangingRef.current) {
          return
        }
        if (isSessionWithDockviewLayout(sessionRef.current)) {
          const viewIds = sessionRef.current.getViewIdsForPanel(e.id)
          for (const viewId of viewIds) {
            const view = sessionRef.current.views.find(v => v.id === viewId)
            if (view) {
              sessionRef.current.removeView(view)
            }
          }
          sessionRef.current.removePanel(e.id)
        }
      })

      event.api.onDidLayoutChange(() => {
        if (
          !rearrangingRef.current &&
          isSessionWithDockviewLayout(sessionRef.current)
        ) {
          sessionRef.current.setDockviewLayout(
            cleanLayoutForStorage(event.api.toJSON()),
          )
        }
      })

      // If there's a pending move action, always create fresh panels to handle it
      // Otherwise, try to restore from saved layout if available
      const hasPendingAction = peekPendingMoveAction() !== null
      const dockviewSession = isSessionWithDockviewLayout(sessionRef.current)
        ? sessionRef.current
        : null
      const savedLayout = !hasPendingAction && dockviewSession?.dockviewLayout

      if (savedLayout) {
        try {
          rearrangingRef.current = true
          event.api.fromJSON(savedLayout)
          updatePanelParams(event.api, dockviewSession)

          // Rebuild panel-view assignments from restored panel params
          dockviewSession.clearPanelViewAssignments()
          trackedViewIdsRef.current.clear()
          for (const panel of event.api.panels) {
            const viewId = panel.params?.viewId
            if (viewId && session.views.some(v => v.id === viewId)) {
              dockviewSession.assignViewToPanel(panel.id, viewId)
              trackedViewIdsRef.current.add(viewId)
            }
          }

          // Verify restoration succeeded - if no panels, fall back to fresh creation
          if (event.api.panels.length === 0) {
            throw new Error('No panels after fromJSON restore')
          }
        } catch (e) {
          console.error('Failed to restore dockview layout:', e)
          createInitialPanels(event.api)
        } finally {
          rearrangingRef.current = false
        }
      } else {
        createInitialPanels(event.api)
      }
    },
    [createInitialPanels],
  )

  useEffect(() => {
    const dispose = autorun(() => {
      if (!api) {
        return
      }

      const { views } = session
      const currentViewIds = new Set(views.map(v => v.id))
      const trackedIds = trackedViewIdsRef.current

      for (const view of views) {
        if (!trackedIds.has(view.id)) {
          trackedIds.add(view.id)

          if (isSessionWithDockviewLayout(session)) {
            const { panelId } = addPanelForView(api, session, view.id, {
              referenceGroup: api.activeGroup ?? undefined,
              direction: 'right',
            })
            session.assignViewToPanel(panelId, view.id)
            session.setActivePanelId(panelId)
            api.getPanel(panelId)?.api.setActive()
          }
        }
      }

      for (const id of trackedIds) {
        if (!currentViewIds.has(id)) {
          trackedIds.delete(id)
          if (isSessionWithDockviewLayout(session)) {
            const panelId = session.getPanelIdForView(id)
            session.removeViewFromPanel(id)
            if (panelId) {
              const panel = api.getPanel(panelId)
              if (panel) {
                api.removePanel(panel)
              }
            }
          }
        }
      }
    })

    return dispose
  }, [session, api])

  // Keep panel params in sync when the session instance changes (e.g. session
  // switch). Old panels will render with the new session until the view-tracking
  // autorun removes panels whose views no longer exist.
  useEffect(() => {
    if (api && isSessionWithDockviewLayout(session)) {
      updatePanelParams(api, session)
    }
  }, [api, session])

  // React to layout changes from undo/redo
  useEffect(() => {
    if (!api || !isSessionWithDockviewLayout(session)) {
      return
    }

    const dispose = autorun(() => {
      const { dockviewLayout } = session
      if (!dockviewLayout || rearrangingRef.current) {
        return
      }

      // Compare current dockview state with session state
      const currentLayout = cleanLayoutForStorage(api.toJSON())
      if (JSON.stringify(currentLayout) === JSON.stringify(dockviewLayout)) {
        return
      }

      // Layout differs - restore from session (likely from undo/redo)
      rearrangingRef.current = true
      try {
        api.fromJSON(dockviewLayout)
        updatePanelParams(api, sessionRef.current)

        // Rebuild panel-view assignments and tracked IDs from restored layout
        sessionRef.current.clearPanelViewAssignments()
        trackedViewIdsRef.current.clear()
        for (const panel of api.panels) {
          const viewId = panel.params?.viewId
          if (viewId && session.views.some(v => v.id === viewId)) {
            sessionRef.current.assignViewToPanel(panel.id, viewId)
            trackedViewIdsRef.current.add(viewId)
          }
        }
      } catch (e) {
        console.error('Failed to restore dockview layout from undo:', e)
      } finally {
        rearrangingRef.current = false
      }
    })

    return dispose
  }, [session, api])

  const themeClass =
    theme.palette.mode === 'dark'
      ? 'dockview-theme-dark'
      : 'dockview-theme-light'

  return (
    <DockviewContext.Provider value={contextValue}>
      <div className={cx(classes.container, classes.noTabs, themeClass)}>
        <DockviewReact components={components} onReady={onReady} />
      </div>
    </DockviewContext.Provider>
  )
})

export default TiledViewsContainer
