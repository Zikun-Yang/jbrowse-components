import { LoadingEllipses } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import ImportForm from './ImportForm.tsx'

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
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing(4),
  },
}))

const SingleCellView = observer(function SingleCellView({
  model,
}: {
  model: SingleCellViewModel
}) {
  const { showLoading, showView, showImportForm } = model

  if (showLoading) {
    return <LoadingEllipses variant="h6" message="Loading single-cell dataset..." />
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
  const { dataset, embedding, colorBy } = model

  return (
    <div className={classes.root}>
      <div className={classes.viewContainer}>
        <p>Single Cell View Loaded</p>
        <p>Dataset: {dataset}</p>
        <p>Embedding: {embedding}</p>
        <p>Color by: {colorBy}</p>
      </div>
    </div>
  )
})

export default SingleCellView
