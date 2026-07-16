import type { SnackbarMessage } from '@jbrowse/core/ui/SnackbarModel'
import type {
  AbstractViewContainer,
  SessionWithFocusedViewAndDrawerWidgets,
} from '@jbrowse/core/util'

import type { SessionWithDockviewLayout } from '../../DockviewLayout/index.ts'

export type DockviewSessionType = SessionWithFocusedViewAndDrawerWidgets &
  AbstractViewContainer &
  SessionWithDockviewLayout & {
    renameCurrentSession: (arg: string) => void
    snackbarMessages: SnackbarMessage[]
    popSnackbarMessage: () => unknown
  }
