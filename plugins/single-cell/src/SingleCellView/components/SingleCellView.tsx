import { LoadingEllipses } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Chip, Paper, Typography } from '@mui/material'
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
    padding: theme.spacing(2),
  },
  infoPanel: {
    padding: theme.spacing(2),
    marginBottom: theme.spacing(2),
  },
  chipRow: {
    display: 'flex',
    gap: theme.spacing(1),
    flexWrap: 'wrap',
    marginTop: theme.spacing(1),
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

  const categoricalCols = Object.entries(data.metadata).filter(
    ([_, col]) => col.type === 'categorical',
  ) as [string, import('../../SingleCellAdapter/SingleCellZarrAdapter.ts').CategoricalColumn][]

  return (
    <div className={classes.root}>
      <div className={classes.viewContainer}>
        <Paper className={classes.infoPanel} variant="outlined">
          <Typography variant="h6">Single Cell Dataset</Typography>
          <Typography variant="body2" color="textSecondary">
            {dataset}
          </Typography>

          <Typography variant="body1" sx={{ mt: 1 }}>
            Cells: <strong>{data.nObs.toLocaleString()}</strong> | Genes:{' '}
            <strong>{data.nVar.toLocaleString()}</strong>
          </Typography>

          <Typography variant="body1" sx={{ mt: 1 }}>
            Embedding: <strong>{embedding}</strong> | Color by:{' '}
            <strong>{colorBy}</strong>
          </Typography>

          {data.embeddings.length > 0 ? (
            <>
              <Typography variant="subtitle2" sx={{ mt: 2 }}>
                Available embeddings:
              </Typography>
              <div className={classes.chipRow}>
                {data.embeddings.map(emb => (
                  <Chip
                    key={emb}
                    label={emb}
                    size="small"
                    color={emb === embedding ? 'primary' : 'default'}
                    onClick={() => model.setEmbedding(emb)}
                  />
                ))}
              </div>
            </>
          ) : null}

          {categoricalCols.length > 0 ? (
            <>
              <Typography variant="subtitle2" sx={{ mt: 2 }}>
                Categorical metadata:
              </Typography>
              <div className={classes.chipRow}>
                {categoricalCols.map(([name, col]) => (
                  <Chip
                    key={name}
                    label={`${name} (${col.categories.length} categories)`}
                    size="small"
                    color={name === colorBy ? 'secondary' : 'default'}
                    onClick={() => model.setColorBy(name)}
                  />
                ))}
              </div>
            </>
          ) : null}
        </Paper>

        <Typography variant="body2" color="textSecondary">
          WebGL UMAP rendering will be implemented in Phase 2
        </Typography>
      </div>
    </div>
  )
})

export default SingleCellView
