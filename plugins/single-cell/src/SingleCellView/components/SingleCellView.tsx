import { LoadingEllipses } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Paper, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import EmbeddingCanvas from './EmbeddingCanvas.tsx'
import ImportForm from './ImportForm.tsx'
import LassoOverlay from './LassoOverlay.tsx'
import Toolbar from './Toolbar.tsx'

import type { SingleCellViewModel } from '../model.ts'

const useStyles = makeStyles()(theme => ({
  root: {
    position: 'relative',
    marginBottom: theme.spacing(1),
    overflow: 'hidden',
    backgroundColor: theme.palette.background.default,
  },
  viewContainer: {
    display: 'flex',
    flexDirection: 'column',
    padding: theme.spacing(2),
  },
  canvasWrapper: {
    position: 'relative',
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    overflow: 'hidden',
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
  const { data, dataset, embedding, colorBy } = model

  if (!data) {
    return <div>No data loaded</div>
  }

  return (
    <div className={classes.root}>
      <div className={classes.viewContainer}>
        <Paper variant="outlined" sx={{ mb: 1, p: 1 }}>
          <Typography variant="subtitle1">
            {dataset} — {data.nObs.toLocaleString()} cells, {data.nVar.toLocaleString()} genes
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Embedding: <strong>{embedding}</strong> | Color by: <strong>{colorBy}</strong>
          </Typography>
        </Paper>

        <Toolbar model={model} />

        <div className={classes.canvasWrapper} style={{ width: model.width, height: model.height - 100 }}>
          <EmbeddingCanvas model={model} />
          <LassoOverlay
            model={model}
            onLassoEnd={selected => model.setSelectedCells(selected)}
            onRectEnd={selected => model.setSelectedCells(selected)}
          />
        </div>
      </div>
    </div>
  )
})

export default SingleCellView
