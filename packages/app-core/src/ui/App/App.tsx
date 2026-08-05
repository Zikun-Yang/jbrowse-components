import { Suspense, lazy } from 'react'

import Snackbar from '@jbrowse/core/ui/Snackbar'
import { getEnv } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { AppBar } from '@mui/material'
import { observer } from 'mobx-react'

import AppFab from './AppFab.tsx'
import AppToolbar from './AppToolbar.tsx'
import DialogQueue from './DialogQueue.tsx'
import LeftSidebar from './LeftSidebar.tsx'
import ViewsContainer from './ViewsContainer.tsx'

import type { MenuItem as JBMenuItem } from '@jbrowse/core/ui'
import type { SnackbarMessage } from '@jbrowse/core/ui/SnackbarModel'
import type { SessionWithFocusedViewAndDrawerWidgets } from '@jbrowse/core/util'
import type { SessionWithDockviewLayout } from '../../DockviewLayout/index.ts'
import type { ThemeOptions } from '@mui/material'

interface Menu {
  label: string
  menuItems: JBMenuItem[]
}

interface SessionMetadata {
  id: string
  name: string
  createdAt: Date
  configPath: string
  favorite: boolean
}

interface History {
  canUndo: boolean
  canRedo: boolean
  undo: () => void
  redo: () => void
}

interface Props {
  HeaderButtons?: React.ReactElement
  session: SessionWithFocusedViewAndDrawerWidgets &
    SessionWithDockviewLayout & {
      menus: () => Menu[]
      snackbarMessages: SnackbarMessage[]
      renameCurrentSession: (arg: string) => void
      popSnackbarMessage: () => unknown
      activeView?: 'landing' | 'workspace' | 'recents' | 'settings'
      showRecentsDashboard?: boolean
      setActiveView?: (
        view: 'landing' | 'workspace' | 'recents' | 'settings',
      ) => void
      setDefaultSession?: () => void
      activateSession?: (id: string) => Promise<void>
      savedSessionMetadata?: SessionMetadata[]
      allThemes?: () => Record<string, ThemeOptions & { name?: string }>
      themeName?: string
      setThemeName?: (arg: string) => void
      root: { history: History }
    }
}

// lazies
const DrawerWidget = lazy(() => import('./DrawerWidget.tsx'))
const ModalWidget = lazy(() => import('./ModalWidget.tsx'))

const useStyles = makeStyles()(theme => ({
  root: {
    display: 'grid',
    height: '100vh',
    width: '100%',
    colorScheme: theme.palette.mode,
    padding: '12px 12px 12px 0',
    gap: 0,
    background: theme.palette.background.default,
    transition: 'grid-template-columns 200ms ease',
    boxSizing: 'border-box',
  },
  appContainer: {
    gridColumn: 'main',
    display: 'grid',
    gridTemplateRows: '[menubar] min-content [components] auto',
    height: '100%',
    background: theme.palette.background.paper,
    borderRadius: 12,
    border: `1px solid ${theme.palette.divider}`,
    overflow: 'hidden',
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
  },
  appBar: {
    gridRow: 'menubar',
    flexGrow: 1,
    background: 'transparent',
    boxShadow: 'none',
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
}))

const LazyDrawerWidget = observer(function LazyDrawerWidget(props: Props) {
  const { session } = props
  return (
    <Suspense fallback={null}>
      <DrawerWidget session={session} />
    </Suspense>
  )
})

const LazyModalWidget = observer(function LazyModalWidget(props: Props) {
  const { session } = props
  const { visibleWidget } = session
  return visibleWidget ? (
    <Suspense fallback={null}>
      <ModalWidget
        session={session}
        onClose={() => {
          session.hideWidget(visibleWidget)
        }}
      />
    </Suspense>
  ) : null
})

const App = observer(function App(props: Props) {
  const { session } = props
  const { classes } = useStyles()
  const { minimized, visibleWidget, drawerWidth, drawerPosition } = session
  const modalWidget = visibleWidget
    ? getEnv(session).pluginManager.getWidgetType(visibleWidget.type)!
        .modalByDefault
    : false
  const drawerVisible = visibleWidget && !minimized && !modalWidget
  const expanded =
    session.activeView === 'recents' ||
    session.activeView === 'settings' ||
    session.activeView === 'landing'
  const sidebarWidth = expanded ? 180 : 44
  const sidebar = `[sidebar] ${sidebarWidth}px`
  const d = drawerVisible ? `[drawer] ${drawerWidth}px` : undefined
  const grid =
    drawerPosition === 'right'
      ? [sidebar, '[main] 1fr', d]
      : [sidebar, d, '[main] 1fr']

  return (
    <div
      className={classes.root}
      style={{ gridTemplateColumns: grid.filter(f => !!f).join(' ') }}
    >
      <LeftSidebar session={session} />
      {drawerVisible && drawerPosition === 'left' ? (
        <LazyDrawerWidget session={session} />
      ) : null}
      {modalWidget ? <LazyModalWidget session={session} /> : null}
      <DialogQueue session={session} />
      <div className={classes.appContainer}>
        <AppBar className={classes.appBar} position="static">
          <AppToolbar {...props} />
        </AppBar>
        <ViewsContainer {...props} />
      </div>
      <AppFab session={session} />

      {drawerVisible && drawerPosition === 'right' ? (
        <LazyDrawerWidget session={session} />
      ) : null}

      <Snackbar session={session} />
    </div>
  )
})

export { App }
