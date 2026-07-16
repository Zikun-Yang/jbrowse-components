import { makeStyles } from '@jbrowse/core/util/tss-react'
import AddIcon from '@mui/icons-material/Add'
import DashboardIcon from '@mui/icons-material/Dashboard'
import { observer } from 'mobx-react'

const useStyles = makeStyles()(theme => ({
  root: {
    flex: 1,
    overflowY: 'auto',
    padding: '24px 32px',
    background: theme.palette.background.paper,
  },
  grid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 20,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  card: {
    width: 240,
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
    gap: 8,
    color: theme.palette.text.secondary,
    '&:hover': {
      background: theme.palette.background.paper,
      color: theme.palette.text.primary,
    },
  },
  addIcon: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    display: 'grid',
    placeItems: 'center',
    color: theme.palette.softTeal.main,
  },
  addLabel: {
    fontSize: 12,
    fontWeight: 500,
  },
  addDesc: {
    fontSize: 10,
    color: theme.palette.text.secondary,
  },
  thumb: {
    flex: 1,
    background: theme.palette.background.default,
    position: 'relative',
    overflow: 'hidden',
  },
  thumbPlaceholder: {
    position: 'absolute',
    inset: 0,
    display: 'grid',
    placeItems: 'center',
    fontSize: 10,
    color: theme.palette.text.secondary,
  },
  info: {
    padding: '12px 14px',
    borderTop: `1px solid ${theme.palette.divider}`,
  },
  name: {
    fontSize: 13,
    fontWeight: 600,
    color: theme.palette.text.primary,
    marginBottom: 3,
  },
  desc: {
    fontSize: 11,
    color: theme.palette.text.secondary,
    lineHeight: 1.4,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  empty: {
    width: '100%',
    padding: '40px 0',
    textAlign: 'center',
    color: theme.palette.text.secondary,
    fontSize: 13,
  },
}))

interface SessionMetadata {
  id: string
  name: string
  createdAt: Date
  configPath: string
  favorite: boolean
}

interface DashboardSession {
  savedSessionMetadata?: SessionMetadata[]
  setShowRecentsDashboard?: (show: boolean) => void
  activateSession?: (id: string) => Promise<void>
  setDefaultSession?: () => void
  addView?: (typeName: string, initialState: Record<string, unknown>) => unknown
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

const RecentsDashboard = observer(function RecentsDashboard({
  session,
}: {
  session: DashboardSession
}) {
  const { classes, cx } = useStyles()
  const { savedSessionMetadata = [] } = session

  const handleNewWorkspace = () => {
    session.setShowRecentsDashboard?.(false)
    session.setDefaultSession?.()
  }

  const handleFromTemplate = () => {
    session.setShowRecentsDashboard?.(false)
    session.addView?.('LinearGenomeView', {})
  }

  const handleOpenSession = async (id: string) => {
    await session.activateSession?.(id)
    session.setShowRecentsDashboard?.(false)
  }

  return (
    <div className={classes.root}>
      <div className={classes.grid}>
        <button
          className={cx(classes.card, classes.newCard)}
          onClick={handleNewWorkspace}
          type="button"
        >
          <div className={classes.addIcon}>
            <AddIcon fontSize="small" />
          </div>
          <div className={classes.addLabel}>New Workspace</div>
          <div className={classes.addDesc}>Start from scratch</div>
        </button>

        <button
          className={cx(classes.card, classes.newCard)}
          onClick={handleFromTemplate}
          type="button"
        >
          <div className={classes.addIcon}>
            <DashboardIcon fontSize="small" />
          </div>
          <div className={classes.addLabel}>From Template</div>
          <div className={classes.addDesc}>Use a preset layout</div>
        </button>

        {savedSessionMetadata.map(meta => (
          <button
            key={meta.id}
            className={classes.card}
            onClick={() => handleOpenSession(meta.id)}
            type="button"
          >
            <div className={classes.thumb}>
              <div className={classes.thumbPlaceholder}>workspace preview</div>
            </div>
            <div className={classes.info}>
              <div className={classes.name}>{meta.name}</div>
              <div className={classes.desc}>Opened {formatDate(meta.createdAt)}</div>
            </div>
          </button>
        ))}

        {savedSessionMetadata.length === 0 ? (
          <div className={classes.empty}>
            No recent workspaces. Create one to get started.
          </div>
        ) : null}
      </div>
    </div>
  )
})

export default RecentsDashboard
