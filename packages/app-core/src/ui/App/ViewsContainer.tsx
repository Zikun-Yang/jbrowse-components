import { Suspense, lazy } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import type { SnackbarMessage } from '@jbrowse/core/ui/SnackbarModel'
import type {
  AbstractViewContainer,
  SessionWithFocusedViewAndDrawerWidgets,
} from '@jbrowse/core/util'
import type { SessionWithDockviewLayout } from '../../DockviewLayout/index.ts'
import type { ThemeOptions } from '@mui/material'

const TiledViewsContainer = lazy(() => import('./TiledViewsContainer.tsx'))
const RecentsDashboard = lazy(() => import('./RecentsDashboard.tsx'))
const LandingPage = lazy(() => import('./LandingPage.tsx'))
const SettingsView = lazy(() => import('./SettingsView.tsx'))

const useStyles = makeStyles()({
  viewsContainer: {
    gridRow: 'components',
    overflow: 'hidden',
  },
  workspace: {
    backgroundImage: `radial-gradient(rgba(0, 0, 0, 0.12) 1px, transparent 1px)`,
    backgroundSize: '24px 24px',
  },
})

interface SessionMetadata {
  id: string
  name: string
  createdAt: Date
  configPath: string
  favorite: boolean
}

interface Props {
  HeaderButtons?: React.ReactElement
  session: SessionWithFocusedViewAndDrawerWidgets &
    AbstractViewContainer &
    SessionWithDockviewLayout & {
      renameCurrentSession: (arg: string) => void
      snackbarMessages: SnackbarMessage[]
      popSnackbarMessage: () => unknown
      activeView?: 'landing' | 'workspace' | 'recents' | 'settings'
      showRecentsDashboard?: boolean
      setShowRecentsDashboard?: (show: boolean) => void
      setActiveView?: (
        view: 'landing' | 'workspace' | 'recents' | 'settings',
      ) => void
      setDefaultSession?: () => void
      activateSession?: (id: string) => Promise<void>
      savedSessionMetadata?: SessionMetadata[]
      allThemes?: () => Record<string, ThemeOptions & { name?: string }>
      themeName?: string
      setThemeName?: (arg: string) => void
      stickyViewHeaders?: boolean
      setStickyViewHeaders?(sticky: boolean): void
    }
}

const ViewsContainer = observer(function ViewsContainer(props: Props) {
  const { session } = props
  const { views } = session
  const { classes, cx } = useStyles()

  const view = session.activeView || 'workspace'

  let content: React.ReactNode
  switch (view) {
    case 'landing':
      content = <LandingPage session={session} />
      break
    case 'recents':
    case 'settings':
      content =
        view === 'recents' ? (
          <RecentsDashboard session={session} />
        ) : (
          <SettingsView session={session} />
        )
      break
    case 'workspace':
    default:
      content = views.length > 0 ? <TiledViewsContainer session={session} /> : null
  }

  return (
    <div
      className={cx(classes.viewsContainer, {
        [classes.workspace]: view === 'workspace',
      })}
    >
      <Suspense fallback={null}>{content}</Suspense>
    </div>
  )
})

export default ViewsContainer
