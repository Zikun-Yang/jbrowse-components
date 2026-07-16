import { createContext, useContext } from 'react'

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
