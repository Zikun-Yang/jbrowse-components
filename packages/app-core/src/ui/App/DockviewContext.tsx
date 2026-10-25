import { createContext, useContext, useSyncExternalStore } from 'react'

import type { DockviewApi, DockviewGroupPanel } from 'dockview-react'

interface DockviewContextValue {
  api: DockviewApi | null
  rearrangePanels: (arrange: (api: DockviewApi) => void) => void
  moveViewToSplitRight: (viewId: string) => void
}

// Pending action stored when workspaces not yet enabled
let pendingMoveAction: {
  type: 'splitRight'
  viewId: string
} | null = null

export function peekPendingMoveAction() {
  return pendingMoveAction
}

export function clearPendingMoveAction() {
  pendingMoveAction = null
}

export function getPendingMoveAction() {
  const action = pendingMoveAction
  pendingMoveAction = null
  return action
}

// Functions to set pending actions (used by default context and for testing)
export function setPendingMoveToSplitRight(viewId: string) {
  pendingMoveAction = { type: 'splitRight', viewId }
}

export const DockviewContext = createContext<DockviewContextValue>({
  api: null,
  rearrangePanels: () => {},
  moveViewToSplitRight: setPendingMoveToSplitRight,
})

export function useDockview() {
  return useContext(DockviewContext)
}

// Module-level store for the dockview api, so components rendered outside the
// DockviewContext provider subtree (e.g. WorkspaceToolbar in the AppBar) can
// still access it
let currentApi: DockviewApi | null = null
const listeners = new Set<() => void>()

function notifyDockviewListeners() {
  for (const listener of listeners) {
    listener()
  }
}

export function setDockviewApi(api: DockviewApi | null) {
  currentApi = api
  notifyDockviewListeners()
}

export function getDockviewApi() {
  return currentApi
}

// call when the panel layout changes (panel count, arrangement) so
// useSyncExternalStore subscribers re-render
export function notifyDockviewLayoutChanged() {
  notifyDockviewListeners()
}

export function useDockviewPanelCount() {
  return useSyncExternalStore(
    (cb: () => void) => {
      listeners.add(cb)
      return () => {
        listeners.delete(cb)
      }
    },
    () => currentApi?.panels.length ?? 0,
  )
}
