import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Toolbar } from '@mui/material'
import { observer } from 'mobx-react'

import WorkspaceToolbar from './WorkspaceToolbar.tsx'

import type { SnackbarMessage } from '@jbrowse/core/ui/SnackbarModel'
import type { SessionWithDrawerWidgets } from '@jbrowse/core/util'

const useStyles = makeStyles()(theme => ({
  toolbar: {
    display: 'flex',
    justifyContent: 'space-between',
  },
  side: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
  },
  rightSide: {
    justifyContent: 'flex-end',
  },
  center: {
    flex: '0 0 auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 15,
    fontWeight: 600,
    color: theme.palette.text.primary,
  },
}))

interface History {
  canUndo: boolean
  canRedo: boolean
  undo: () => void
  redo: () => void
}

interface Props {
  HeaderButtons?: React.ReactElement
  session: SessionWithDrawerWidgets & {
    snackbarMessages: SnackbarMessage[]
    popSnackbarMessage: () => unknown
    activeView?: 'landing' | 'workspace' | 'recents' | 'settings'
    showRecentsDashboard?: boolean
    addView: (typeName: string, initialState?: Record<string, unknown>) => unknown
    root: {
      history: History
    }
  }
}

const AppToolbar = observer(function AppToolbar({
  HeaderButtons = <div />,
  session,
}: Props) {
  const { classes, cx } = useStyles()
  const view = session.activeView || 'workspace'
  const titles: Record<string, string> = {
    landing: 'Home',
    recents: 'Recents',
    settings: 'Settings',
  }

  return (
    <Toolbar className={classes.toolbar}>
      <div className={classes.side} />
      <div className={classes.center}>
        {view === 'workspace' ? (
          <WorkspaceToolbar session={session} />
        ) : titles[view] ? (
          <div className={classes.title}>{titles[view]}</div>
        ) : null}
      </div>
      <div className={cx(classes.side, classes.rightSide)}>{HeaderButtons}</div>
    </Toolbar>
  )
})

export default AppToolbar
