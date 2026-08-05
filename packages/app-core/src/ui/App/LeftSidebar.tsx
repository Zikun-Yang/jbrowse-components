import { CascadingMenuButton } from '@jbrowse/core/ui'
import EditableTypography from '@jbrowse/core/ui/EditableTypography'
import { isSessionModelWithWidgets } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Tooltip } from '@mui/material'
import { observer } from 'mobx-react'

import {
  AccessTimeIcon,
  GridViewIcon,
  HomeIcon,
  MoreVertIcon,
  SettingsIcon,
} from '@jbrowse/core/ui/Icons'

import type { MenuItem as JBMenuItem } from '@jbrowse/core/ui'
import type { SnackbarMessage } from '@jbrowse/core/ui/SnackbarModel'
import type { SessionWithDrawerWidgets } from '@jbrowse/core/util'

type AppSession = SessionWithDrawerWidgets & {
  menus: () => Menu[]
  snackbarMessages: SnackbarMessage[]
  renameCurrentSession: (arg: string) => void
  popSnackbarMessage: () => unknown
  activeView?: 'landing' | 'workspace' | 'recents' | 'settings'
  setActiveView?: (
    view: 'landing' | 'workspace' | 'recents' | 'settings',
  ) => void
  setShowRecentsDashboard?: (show: boolean) => void
}

interface Menu {
  label: string
  menuItems: JBMenuItem[] | (() => JBMenuItem[])
}

const useStyles = makeStyles()(theme => ({
  sidebar: {
    width: 44,
    height: '100%',
    position: 'relative',
    background: theme.palette.background.default,
    borderRadius: '12px 0 0 12px',
    zIndex: theme.zIndex.appBar,
    transition: 'width 200ms ease',
    '&:hover .sidebar-inner, .sidebar-inner:hover': {
      width: 180,
    },
  },
  sidebarExpanded: {
    width: 180,
  },
  inner: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 44,
    background: theme.palette.background.default,
    borderRadius: '12px 0 0 12px',
    display: 'flex',
    flexDirection: 'column',
    padding: '12px 0',
    gap: 4,
    overflow: 'hidden',
    transition:
      'width 200ms ease, border-radius 200ms ease, box-shadow 200ms ease',
    '&.sidebar-collapsed::after': {
      content: '""',
      position: 'absolute',
      inset: 0,
      borderTop: '1px solid transparent',
      borderRight: '1px solid transparent',
      borderBottom: '1px solid transparent',
      borderLeft: 'none',
      borderRadius: '0 12px 12px 0',
      pointerEvents: 'none',
      transition: 'border-color 200ms ease',
    },
    '.sidebar:hover &.sidebar-collapsed::after, &.sidebar-collapsed:hover::after':
      {
        borderTopColor: theme.palette.divider,
        borderRightColor: theme.palette.divider,
        borderBottomColor: theme.palette.divider,
      },
    '.sidebar:hover &.sidebar-collapsed, &.sidebar-collapsed:hover': {
      borderRadius: '0 12px 12px 0',
      boxShadow: '2px 2px 6px rgba(0, 0, 0, 0.04)',
    },
  },
  innerExpanded: {
    position: 'relative',
    width: '100%',
    height: '100%',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: 0,
    height: 32,
    padding: '0 11px',
    marginBottom: 16,
    fontWeight: 600,
    fontSize: 15,
    letterSpacing: '-0.01em',
    whiteSpace: 'nowrap',
  },
  logoMark: {
    width: 22,
    height: 22,
    borderRadius: 5,
    background: theme.palette.text.primary,
    display: 'grid',
    placeItems: 'center',
    flexShrink: 0,
  },
  logoText: {
    color: theme.palette.text.primary,
    opacity: 0,
    maxWidth: 0,
    marginLeft: 0,
    overflow: 'hidden',
    transition:
      'opacity 150ms ease, max-width 200ms ease, margin-left 200ms ease',
    '.sidebar-expanded &, .sidebar:hover &, .sidebar-inner:hover &': {
      opacity: 1,
      maxWidth: 120,
      marginLeft: 10,
    },
  },
  navButton: {
    width: 32,
    height: 32,
    margin: '4px 6px',
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0,
    borderRadius: 8,
    color: theme.palette.text.secondary,
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    position: 'relative',
    transition: 'all 150ms ease',
    flexShrink: 0,
    '&:hover': {
      background: '#fff',
      color: theme.palette.text.primary,
      boxShadow: '0 1px 4px rgba(0, 0, 0, 0.06)',
    },
    '.sidebar-inner:hover &, .sidebar-expanded &': {
      width: 'calc(100% - 12px)',
      justifyContent: 'flex-start',
      paddingLeft: 9,
    },
  },
  navButtonActive: {
    background: '#fff',
    color: theme.palette.primary.main,
    boxShadow: '0 1px 4px rgba(0, 0, 0, 0.06)',
  },
  navIcon: {
    width: 20,
    height: 20,
    display: 'grid',
    placeItems: 'center',
    flexShrink: 0,
  },
  navLabel: {
    fontSize: 14,
    fontWeight: 600,
    lineHeight: 1,
    // Latin glyphs sit on the baseline, so their optical center is ~1px above
    // the geometric center; nudge down to align with the icon
    transform: 'translateY(1px)',
    whiteSpace: 'nowrap',
    opacity: 0,
    maxWidth: 0,
    marginLeft: 0,
    overflow: 'hidden',
    transition:
      'opacity 150ms ease, max-width 200ms ease, margin-left 200ms ease',
    '.sidebar-expanded &, .sidebar:hover &, .sidebar-inner:hover &': {
      opacity: 1,
      maxWidth: 120,
      marginLeft: 10,
    },
  },
  spacer: {
    flex: 1,
  },
  footer: {
    padding: '0 8px',
    marginTop: 8,
    whiteSpace: 'nowrap',
  },
  user: {
    display: 'flex',
    alignItems: 'center',
    gap: 0,
    padding: '8px 0',
    borderTop: `1px solid ${theme.palette.divider}`,
  },
  userText: {
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    opacity: 0,
    maxWidth: 0,
    marginLeft: 0,
    transition:
      'opacity 150ms ease, max-width 200ms ease, margin-left 200ms ease',
    '.sidebar-expanded &, .sidebar:hover &, .sidebar-inner:hover &': {
      opacity: 1,
      maxWidth: 120,
      marginLeft: 10,
    },
  },
  userName: {
    fontSize: 12,
    fontWeight: 500,
    color: theme.palette.text.primary,
  },
  userRole: {
    fontSize: 10,
    color: theme.palette.text.secondary,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    background: theme.palette.primary.main,
    color: '#fff',
    display: 'grid',
    placeItems: 'center',
    fontSize: 11,
    fontWeight: 600,
    border: `1px solid ${theme.palette.divider}`,
    flexShrink: 0,
  },
}))

function wrapMenuItems(items: JBMenuItem[], session: AppSession): JBMenuItem[] {
  return items.map(item => ({
    ...item,
    ...('onClick' in item
      ? {
          onClick: () => {
            item.onClick(session)
          },
        }
      : {}),
    ...('subMenu' in item
      ? { subMenu: wrapMenuItems(item.subMenu, session) }
      : {}),
  }))
}

const LeftSidebar = observer(function LeftSidebar({
  session,
}: {
  session: AppSession
}) {
  const { classes, cx } = useStyles()
  const { name, menus } = session
  const activeView = session.activeView || 'workspace'
  const autoCollapse = activeView === 'workspace'

  const setView = (view: 'landing' | 'workspace' | 'recents' | 'settings') => {
    if (session.setActiveView) {
      session.setActiveView(view)
    } else if (view === 'recents' && session.setShowRecentsDashboard) {
      session.setShowRecentsDashboard(true)
    } else if (view === 'workspace' && session.setShowRecentsDashboard) {
      session.setShowRecentsDashboard(false)
    } else if (isSessionModelWithWidgets(session)) {
      session.showWidget(session.addWidget('SessionManager', 'sessionManager'))
    }
  }

  const handleOpenLanding = () => setView('landing')
  const handleOpenRecents = () => setView('recents')
  const handleOpenWorkspace = () => setView('workspace')
  const handleOpenSettings = () => setView('settings')

  return (
    <div
      className={cx(classes.sidebar, !autoCollapse && classes.sidebarExpanded)}
    >
      <div
        className={cx(
          classes.inner,
          'sidebar-inner',
          !autoCollapse && classes.innerExpanded,
          !autoCollapse && 'sidebar-expanded',
          autoCollapse && 'sidebar-collapsed',
        )}
      >
        <div className={classes.logo}>
          <div className={classes.logoMark}>
            <svg
              width="14"
              height="14"
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
          <span className={`${classes.logoText} sidebar-logo-text`}>
            JBrowse
          </span>
        </div>

        <button
          className={cx(
            classes.navButton,
            activeView === 'landing' ? classes.navButtonActive : undefined,
          )}
          onClick={handleOpenLanding}
          type="button"
        >
          <span className={classes.navIcon}>
            <HomeIcon fontSize="small" />
          </span>
          <span className={`${classes.navLabel} sidebar-label`}>Home</span>
        </button>

        <button
          className={cx(
            classes.navButton,
            activeView === 'recents' ? classes.navButtonActive : undefined,
          )}
          onClick={handleOpenRecents}
          type="button"
        >
          <span className={classes.navIcon}>
            <AccessTimeIcon fontSize="small" />
          </span>
          <span className={`${classes.navLabel} sidebar-label`}>Recents</span>
        </button>

        <button
          className={cx(
            classes.navButton,
            activeView === 'workspace' ? classes.navButtonActive : undefined,
          )}
          onClick={handleOpenWorkspace}
          type="button"
        >
          <span className={classes.navIcon}>
            <GridViewIcon fontSize="small" />
          </span>
          <span className={`${classes.navLabel} sidebar-label`}>Workspace</span>
        </button>

        <button
          className={cx(
            classes.navButton,
            activeView === 'settings' ? classes.navButtonActive : undefined,
          )}
          onClick={handleOpenSettings}
          type="button"
        >
          <span className={classes.navIcon}>
            <SettingsIcon fontSize="small" />
          </span>
          <span className={`${classes.navLabel} sidebar-label`}>Settings</span>
        </button>

        <div className={classes.spacer} />

        {menus().map(menu => (
          <CascadingMenuButton
            key={menu.label}
            menuItems={() => {
              const items =
                typeof menu.menuItems === 'function'
                  ? menu.menuItems()
                  : menu.menuItems
              return wrapMenuItems(items, session)
            }}
          >
            <button className={classes.navButton}>
              <span className={classes.navIcon}>
                <MoreVertIcon fontSize="small" />
              </span>
              <span className={`${classes.navLabel} sidebar-label`}>
                {menu.label}
              </span>
            </button>
          </CascadingMenuButton>
        ))}

        <div className={classes.footer}>
          <div className={classes.user}>
            <div className={classes.avatar}>ZY</div>
            <div className={`${classes.userText} sidebar-user-text`}>
              <Tooltip title="Rename session" arrow>
                <div className={classes.userName}>
                  <EditableTypography
                    value={name}
                    variant="body2"
                    setValue={newName => {
                      session.renameCurrentSession(newName)
                    }}
                  />
                </div>
              </Tooltip>
              <div className={classes.userRole}>Researcher</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})

export default LeftSidebar
