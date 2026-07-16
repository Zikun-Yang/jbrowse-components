import { useState } from 'react'

import { getEnv } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import AddIcon from '@mui/icons-material/Add'
import DashboardIcon from '@mui/icons-material/Dashboard'
import RedoIcon from '@mui/icons-material/Redo'
import UndoIcon from '@mui/icons-material/Undo'
import ViewColumnIcon from '@mui/icons-material/ViewColumn'
import ViewModuleIcon from '@mui/icons-material/ViewModule'
import { Button, Menu, MenuItem } from '@mui/material'
import { observer } from 'mobx-react'

import { useDockview } from './DockviewContext.tsx'
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
  const { api, rearrangePanels } = useDockview()

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
    if (api) {
      rearrangePanels(action)
    }
    handleCloseLayout()
  }

  const hasMultiplePanels = (api?.panels.length ?? 0) > 1

  return (
    <div className={classes.toolbar}>
      <Button
        className={classes.button}
        onClick={handleOpenAdd}
        startIcon={<AddIcon className={classes.icon} />}
      >
        Add
      </Button>
      <Menu
        anchorEl={anchorEl}
        open={!!anchorEl}
        onClose={handleCloseAdd}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        transformOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        {viewTypes
          .filter(({ viewMetadata }) => !viewMetadata.hiddenFromGUI)
          .map(({ displayName, name }) => (
            <MenuItem key={name} onClick={() => handleAddView(name)}>
              {displayName}
            </MenuItem>
          ))}
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
      <Button
        className={classes.button}
        onClick={handleOpenLayout}
        startIcon={<DashboardIcon className={classes.icon} />}
        disabled={!hasMultiplePanels}
      >
        Layout
      </Button>
      <Menu
        anchorEl={layoutAnchorEl}
        open={!!layoutAnchorEl}
        onClose={handleCloseLayout}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        transformOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <MenuItem
          onClick={() => handleLayoutAction(tilePanelsHorizontally)}
        >
          <ViewColumnIcon className={classes.menuIcon} /> Tile horizontal
        </MenuItem>
        <MenuItem
          onClick={() => handleLayoutAction(tilePanelsVertically)}
        >
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
    </div>
  )
})

export default WorkspaceToolbar
