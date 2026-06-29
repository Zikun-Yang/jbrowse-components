import { LoadingEllipses, ResizeHandle } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Paper, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import CenterPlot from './CenterPlot.tsx'
import ImportForm from './ImportForm.tsx'
import ObsSidebar from './ObsSidebar.tsx'
import RightSidebar from './RightSidebar.tsx'
import Toolbar from './Toolbar.tsx'

import type { SingleCellViewModel } from '../model.ts'

const useStyles = makeStyles()(theme => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    backgroundColor: theme.palette.background.default,
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  infoRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing(0.5, 1),
    gap: theme.spacing(1),
    flexWrap: 'wrap',
  },
  toolbarRow: {
    padding: theme.spacing(0.5, 1),
  },
  mainRow: {
    display: 'flex',
    flexDirection: 'row',
    flex: 1,
    overflow: 'hidden',
  },
  resizeHandle: {
    width: 4,
    background: 'transparent',
    zIndex: 2,
    '&:hover': {
      background: theme.palette.divider,
    },
  },
  rightSidebar: {
    backgroundColor: theme.palette.background.paper,
    borderLeft: `1px solid ${theme.palette.divider}`,
    height: '100%',
  },
  bottomResizeHandle: {
    height: 4,
    width: '100%',
    background: 'transparent',
    cursor: 'row-resize',
    zIndex: 2,
    '&:hover': {
      background: theme.palette.divider,
    },
  },
}))

const SingleCellView = observer(function SingleCellView({
  model,
}: {
  model: SingleCellViewModel
}) {
  const { showLoading, showView, showImportForm } = model

  if (showLoading) {
    return (
      <LoadingEllipses
        variant="h6"
        message={model.loadingMessage ?? 'Loading...'}
      />
    )
  } else if (showImportForm) {
    return <ImportForm model={model} />
  } else if (showView) {
    return <SingleCellViewLoaded model={model} />
  }
  return null
})

const SingleCellViewLoaded = observer(function SingleCellViewLoaded({
  model,
}: {
  model: SingleCellViewModel
}) {
  const { classes } = useStyles()
  const { data, dataset } = model

  if (!data) {
    return <div>No data loaded</div>
  }

  return (
    <div className={classes.root} style={{ height: model.height }}>
      <Paper variant="outlined" className={classes.header}>
        <div className={classes.infoRow}>
          <Typography variant="subtitle2">
            {dataset} — {data.nObs.toLocaleString()} cells,{' '}
            {data.nVar.toLocaleString()} genes
          </Typography>
        </div>
        <div className={classes.toolbarRow}>
          <Toolbar model={model} />
        </div>
      </Paper>

      <div className={classes.mainRow}>
        <ObsSidebar model={model} />
        <ResizeHandle
          vertical
          flexbox
          onDrag={lastFrameDistance => {
            model.setLeftSidebarWidth(
              Math.max(150, model.leftSidebarWidth + lastFrameDistance),
            )
            return lastFrameDistance
          }}
          className={classes.resizeHandle}
        />
        <CenterPlot model={model} />
        <ResizeHandle
          vertical
          flexbox
          onDrag={lastFrameDistance => {
            model.setRightSidebarWidth(
              Math.max(150, model.rightSidebarWidth - lastFrameDistance),
            )
            return lastFrameDistance
          }}
          className={classes.resizeHandle}
        />
        <RightSidebar model={model} />
      </div>

      <ResizeHandle
        onDrag={lastFrameDistance => {
          model.setHeight(Math.max(200, model.height + lastFrameDistance))
          return lastFrameDistance
        }}
        className={classes.bottomResizeHandle}
      />
    </div>
  )
})

export default SingleCellView
