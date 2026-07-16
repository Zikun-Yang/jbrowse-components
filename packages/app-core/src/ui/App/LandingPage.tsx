import { makeStyles } from '@jbrowse/core/util/tss-react'
import AddIcon from '@mui/icons-material/Add'
import DashboardIcon from '@mui/icons-material/Dashboard'
import SettingsIcon from '@mui/icons-material/Settings'
import { observer } from 'mobx-react'

const useStyles = makeStyles()(theme => ({
  root: {
    flex: 1,
    overflowY: 'auto',
    padding: '48px 56px',
    background: theme.palette.background.paper,
  },
  header: {
    marginBottom: 40,
  },
  logoMark: {
    width: 40,
    height: 40,
    borderRadius: 8,
    background: theme.palette.text.primary,
    display: 'grid',
    placeItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 600,
    letterSpacing: '-0.02em',
    color: theme.palette.text.primary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: theme.palette.text.secondary,
    lineHeight: 1.5,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
    gap: 20,
    marginBottom: 40,
  },
  card: {
    aspectRatio: '4 / 3',
    borderRadius: 12,
    background: theme.palette.background.paper,
    border: `1px solid ${theme.palette.divider}`,
    overflow: 'hidden',
    cursor: 'pointer',
    transition:
      'box-shadow 150ms ease, transform 150ms ease, background 150ms ease',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    padding: 24,
    textAlign: 'left',
    '&:hover': {
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.06)',
      transform: 'translateY(-2px)',
    },
  },
  newCard: {
    borderStyle: 'dashed',
    borderWidth: 2,
    borderColor: theme.palette.softTeal.main,
    background: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    color: theme.palette.text.secondary,
    '&:hover': {
      background: theme.palette.background.paper,
      color: theme.palette.text.primary,
    },
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    display: 'grid',
    placeItems: 'center',
    background: theme.palette.background.default,
    color: theme.palette.text.primary,
    marginBottom: 16,
  },
  newCardIcon: {
    width: 40,
    height: 40,
    borderRadius: '50%',
    display: 'grid',
    placeItems: 'center',
    color: theme.palette.softTeal.main,
    marginBottom: 12,
  },
  cardLabel: {
    fontSize: 15,
    fontWeight: 600,
    color: theme.palette.text.primary,
    marginBottom: 6,
  },
  cardDesc: {
    fontSize: 13,
    color: theme.palette.text.secondary,
    lineHeight: 1.4,
  },
  recentSection: {
    borderTop: `1px solid ${theme.palette.divider}`,
    paddingTop: 32,
  },
  recentTitle: {
    fontSize: 13,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: theme.palette.text.secondary,
    marginBottom: 16,
  },
  recentList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  recentItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    borderRadius: 8,
    border: `1px solid ${theme.palette.divider}`,
    cursor: 'pointer',
    transition: 'background 150ms ease',
    '&:hover': {
      background: theme.palette.background.default,
    },
  },
  recentName: {
    fontSize: 14,
    fontWeight: 500,
    color: theme.palette.text.primary,
  },
  recentDate: {
    fontSize: 12,
    color: theme.palette.text.secondary,
  },
  empty: {
    fontSize: 13,
    color: theme.palette.text.secondary,
  },
}))

interface SessionMetadata {
  id: string
  name: string
  createdAt: Date
  configPath: string
  favorite: boolean
}

interface LandingSession {
  savedSessionMetadata?: SessionMetadata[]
  setActiveView?: (view: 'workspace' | 'recents' | 'settings') => void
  setDefaultSession?: () => void
  activateSession?: (id: string) => Promise<void>
}

function formatDate(date: Date) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
    }).format(new Date(date))
  } catch {
    return ''
  }
}

const LandingPage = observer(function LandingPage({
  session,
}: {
  session: LandingSession
}) {
  const { classes, cx } = useStyles()
  const { savedSessionMetadata = [] } = session
  const recents = savedSessionMetadata.slice(0, 5)

  const handleNewWorkspace = () => {
    session.setDefaultSession?.()
    session.setActiveView?.('workspace')
  }

  const handleOpenRecents = () => {
    session.setActiveView?.('recents')
  }

  const handleOpenSettings = () => {
    session.setActiveView?.('settings')
  }

  const handleOpenSession = async (id: string) => {
    await session.activateSession?.(id)
    session.setActiveView?.('workspace')
  }

  return (
    <div className={classes.root}>
      <div className={classes.header}>
        <div className={classes.logoMark}>
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 6h16M4 12h10M4 18h16" />
          </svg>
        </div>
        <div className={classes.title}>JBrowse</div>
        <div className={classes.subtitle}>
          Open, embeddable genome visualization for the web.
        </div>
      </div>

      <div className={classes.grid}>
        <button
          className={cx(classes.card, classes.newCard)}
          onClick={handleNewWorkspace}
          type="button"
        >
          <div className={classes.newCardIcon}>
            <AddIcon fontSize="medium" />
          </div>
          <div className={classes.cardLabel}>New Workspace</div>
          <div className={classes.cardDesc}>Start from scratch</div>
        </button>

        <button
          className={classes.card}
          onClick={handleOpenRecents}
          type="button"
        >
          <div className={classes.cardIcon}>
            <DashboardIcon fontSize="small" />
          </div>
          <div className={classes.cardLabel}>Open Recents</div>
          <div className={classes.cardDesc}>Continue from saved workspaces</div>
        </button>

        <button
          className={classes.card}
          onClick={handleOpenSettings}
          type="button"
        >
          <div className={classes.cardIcon}>
            <SettingsIcon fontSize="small" />
          </div>
          <div className={classes.cardLabel}>Settings</div>
          <div className={classes.cardDesc}>Theme, layout, and preferences</div>
        </button>
      </div>

      <div className={classes.recentSection}>
        <div className={classes.recentTitle}>Recent Workspaces</div>
        <div className={classes.recentList}>
          {recents.map(meta => (
            <button
              key={meta.id}
              className={classes.recentItem}
              onClick={() => handleOpenSession(meta.id)}
              type="button"
            >
              <div className={classes.recentName}>{meta.name}</div>
              <div className={classes.recentDate}>
                {formatDate(meta.createdAt)}
              </div>
            </button>
          ))}
          {recents.length === 0 ? (
            <div className={classes.empty}>
              No recent workspaces. Create one to get started.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
})

export default LandingPage
