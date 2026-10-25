import { useState } from 'react'

import { getEnv, isSessionModelWithWidgets } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { getSnapshot } from '@jbrowse/mobx-state-tree'
import { Divider, Menu, MenuItem } from '@mui/material'
import { observer } from 'mobx-react'

import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

import {
  AddIcon,
  Cable,
  DashboardIcon,
  GetAppIcon,
  PublishIcon,
  RedoIcon,
  UndoIcon,
  ViewColumnIcon,
  ViewModuleIcon,
} from '@jbrowse/core/ui/Icons'

import { getDockviewApi, useDockviewPanelCount } from './DockviewContext.tsx'
import {
  tilePanelsGrid,
  tilePanelsHorizontally,
  tilePanelsVertically,
} from './dockviewUtils.ts'

import type { DockviewApi } from 'dockview-react'

const useStyles = makeStyles()(theme => ({
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  button: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 56,
    height: 44,
    padding: '6px 8px',
    borderRadius: 8,
    color: theme.palette.text.secondary,
    textTransform: 'none',
    fontSize: 11,
    fontWeight: 500,
    letterSpacing: '0.01em',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 150ms ease',
    '&:hover': {
      background: theme.palette.background.default,
      color: theme.palette.text.primary,
    },
    '&:disabled': {
      color: theme.palette.text.disabled,
      cursor: 'not-allowed',
      background: 'transparent',
    },
  },
  icon: {
    width: 18,
    height: 18,
    marginBottom: 2,
  },
  menuIcon: {
    width: 18,
    height: 18,
    marginRight: 8,
  },
}))

interface History {
  canUndo: boolean
  canRedo: boolean
  undo: () => void
  redo: () => void
}

interface ToolbarSession {
  addView: (typeName: string, initialState?: Record<string, unknown>) => unknown
  root: {
    history: History
  }
}

function exportSession(session: IAnyStateTreeNode) {
  const blob = new Blob(
    [JSON.stringify({ session: getSnapshot(session) }, null, 2)],
    { type: 'text/plain;charset=utf-8' },
  )
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'session.json'
  a.click()
  URL.revokeObjectURL(url)
}

const WorkspaceToolbar = observer(function WorkspaceToolbar({
  session,
}: {
  session: ToolbarSession
}) {
  const { classes } = useStyles()
  const { pluginManager } = getEnv(session)
  const viewTypes = pluginManager.getViewElements()
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)
  const [layoutAnchorEl, setLayoutAnchorEl] = useState<HTMLElement | null>(null)
  const history = session.root.history
  const panelCount = useDockviewPanelCount()

  const handleOpenAdd = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const handleCloseAdd = () => {
    setAnchorEl(null)
  }

  const handleAddView = (typeName: string) => {
    session.addView(typeName, {})
    handleCloseAdd()
  }

  const handleOpenLayout = (event: React.MouseEvent<HTMLElement>) => {
    setLayoutAnchorEl(event.currentTarget)
  }

  const handleCloseLayout = () => {
    setLayoutAnchorEl(null)
  }

  const handleLayoutAction = (action: (api: DockviewApi) => void) => {
    const api = getDockviewApi()
    if (api) {
      action(api)
    }
    handleCloseLayout()
  }

  const hasMultiplePanels = panelCount > 1

  return (
    <div className={classes.toolbar}>
      <button className={classes.button} onClick={handleOpenAdd} type="button">
        <AddIcon className={classes.icon} />
        Add
      </button>
      <Menu
        anchorEl={anchorEl}
        open={!!anchorEl}
        onClose={handleCloseAdd}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        transformOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        {viewTypes
          .filter(({ viewMetadata }) => !viewMetadata.hiddenFromGUI)
          .map(({ displayName, name, icon: Icon }) => (
            <MenuItem key={name} onClick={() => handleAddView(name)}>
              {Icon ? <Icon className={classes.menuIcon} /> : null}
              {displayName}
            </MenuItem>
          ))}
        <Divider />
        <MenuItem
          onClick={() => {
            handleCloseAdd()
            if (isSessionModelWithWidgets(session)) {
              session.showWidget(
                session.widgets.get('addConnectionWidget') ??
                  session.addWidget(
                    'AddConnectionWidget',
                    'addConnectionWidget',
                  ),
              )
            }
          }}
        >
          <Cable className={classes.menuIcon} /> Add connection…
        </MenuItem>
      </Menu>
      <button
        className={classes.button}
        onClick={() => history.undo()}
        disabled={!history.canUndo}
        type="button"
      >
        <UndoIcon className={classes.icon} />
        Undo
      </button>
      <button
        className={classes.button}
        onClick={() => history.redo()}
        disabled={!history.canRedo}
        type="button"
      >
        <RedoIcon className={classes.icon} />
        Redo
      </button>
      <button
        className={classes.button}
        onClick={handleOpenLayout}
        disabled={!hasMultiplePanels}
        type="button"
      >
        <DashboardIcon className={classes.icon} />
        Layout
      </button>
      <Menu
        anchorEl={layoutAnchorEl}
        open={!!layoutAnchorEl}
        onClose={handleCloseLayout}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        transformOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <MenuItem onClick={() => handleLayoutAction(tilePanelsHorizontally)}>
          <ViewColumnIcon className={classes.menuIcon} /> Tile horizontal
        </MenuItem>
        <MenuItem onClick={() => handleLayoutAction(tilePanelsVertically)}>
          <ViewColumnIcon
            className={classes.menuIcon}
            style={{ transform: 'rotate(90deg)' }}
          />{' '}
          Tile vertical
        </MenuItem>
        <MenuItem onClick={() => handleLayoutAction(tilePanelsGrid)}>
          <ViewModuleIcon className={classes.menuIcon} /> Tile grid
        </MenuItem>
      </Menu>
      <button
        className={classes.button}
        onClick={() => {
          if (
            isSessionModelWithWidgets(session) &&
            pluginManager.getWidgetType('ImportSessionWidget')
          ) {
            session.showWidget(
              session.widgets.get('importSessionWidget') ??
                session.addWidget('ImportSessionWidget', 'importSessionWidget'),
            )
          }
        }}
        disabled={!pluginManager.getWidgetType('ImportSessionWidget')}
        type="button"
      >
        <PublishIcon className={classes.icon} />
        Import
      </button>
      <button
        className={classes.button}
        onClick={() => {
          exportSession(session as unknown as IAnyStateTreeNode)
        }}
        type="button"
      >
        <GetAppIcon className={classes.icon} />
        Export
      </button>
    </div>
  )
})

export default WorkspaceToolbar
