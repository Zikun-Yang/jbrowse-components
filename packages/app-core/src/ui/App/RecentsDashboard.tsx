import { makeStyles } from '@jbrowse/core/util/tss-react'
import { IconButton, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'

import { AddIcon, DashboardIcon, FileCopyIcon } from '@jbrowse/core/ui/Icons'

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
  cardAction: {
    position: 'absolute',
    top: 6,
    right: 6,
    background: theme.palette.background.paper,
    border: `1px solid ${theme.palette.divider}`,
    padding: 2,
    opacity: 0,
    transition: 'opacity 150ms ease',
    '.card:hover &': {
      opacity: 1,
    },
    '&:hover': {
      background: theme.palette.background.paper,
    },
  },
  thumbPlaceholder: {
    position: 'absolute',
    inset: 0,
    display: 'grid',
    placeItems: 'center',
    fontSize: 10,
    color: theme.palette.text.secondary,
  },
  thumbImage: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
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
  section: {
    padding: '8px 0 24px',
  },
  sectionDivider: {
    borderTop: `1px solid ${theme.palette.divider}`,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: theme.palette.text.secondary,
    marginBottom: 16,
  },
  sectionEmpty: {
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

interface SessionTemplate {
  name: string
  description?: string
  image?: string
}

interface DashboardSession {
  savedSessionMetadata?: SessionMetadata[]
  sessionTemplates?: SessionTemplate[]
  setShowRecentsDashboard?: (show: boolean) => void
  setActiveView?: (
    view: 'landing' | 'workspace' | 'recents' | 'settings',
  ) => void
  activateSession?: (id: string) => Promise<void>
  duplicateSavedSession?: (id: string) => Promise<void>
  activateTemplate?: (template: { name: string }) => void
  setDefaultSession?: () => void
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
  const { savedSessionMetadata = [], sessionTemplates = [] } = session

  const goToWorkspace = () => {
    if (session.setActiveView) {
      session.setActiveView('workspace')
    } else {
      session.setShowRecentsDashboard?.(false)
    }
  }

  const handleNewWorkspace = () => {
    session.setDefaultSession?.()
    goToWorkspace()
  }

  const handleTemplate = (template: { name: string }) => {
    session.activateTemplate?.(template)
    goToWorkspace()
  }

  const handleOpenSession = async (id: string) => {
    await session.activateSession?.(id)
    goToWorkspace()
  }

  const handleDuplicateSession = async (id: string) => {
    await session.duplicateSavedSession?.(id)
    goToWorkspace()
  }

  return (
    <div className={classes.root}>
      <div className={classes.section}>
        <div className={classes.sectionTitle}>Templates</div>
        {sessionTemplates.length > 0 ? (
          <div className={classes.grid}>
            {sessionTemplates.map(template => (
              <button
                key={template.name}
                className={classes.card}
                onClick={() => {
                  handleTemplate(template)
                }}
                type="button"
              >
                <div className={classes.thumb}>
                  {template.image ? (
                    <img
                      className={classes.thumbImage}
                      src={template.image}
                      alt=""
                    />
                  ) : (
                    <div className={classes.thumbPlaceholder}>
                      <DashboardIcon />
                    </div>
                  )}
                </div>
                <div className={classes.info}>
                  <div className={classes.name}>{template.name}</div>
                  <div className={classes.desc}>
                    {template.description ?? 'Template'}
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className={classes.sectionEmpty}>No templates to be loaded.</div>
        )}
      </div>

      <div className={cx(classes.section, classes.sectionDivider)}>
        <div className={classes.sectionTitle}>Workspaces</div>
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

          {savedSessionMetadata.map(meta => (
            <div
              key={meta.id}
              className={cx(classes.card, 'card')}
              onClick={() => handleOpenSession(meta.id)}
              role="button"
              tabIndex={0}
              onKeyDown={event => {
                if (event.key === 'Enter') {
                  void handleOpenSession(meta.id)
                }
              }}
            >
              <div className={classes.thumb}>
                <div className={classes.thumbPlaceholder}>workspace preview</div>
                {session.duplicateSavedSession ? (
                  <Tooltip title="Duplicate session">
                    <IconButton
                      className={classes.cardAction}
                      size="small"
                      onClick={event => {
                        event.stopPropagation()
                        void handleDuplicateSession(meta.id)
                      }}
                    >
                      <FileCopyIcon fontSize="inherit" />
                    </IconButton>
                  </Tooltip>
                ) : null}
              </div>
              <div className={classes.info}>
                <div className={classes.name}>{meta.name}</div>
                <div className={classes.desc}>
                  Opened {formatDate(meta.createdAt)}
                </div>
              </div>
            </div>
          ))}

          {savedSessionMetadata.length === 0 ? (
            <div className={classes.empty}>
              No recent workspaces. Create one to get started.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
})

export default RecentsDashboard
