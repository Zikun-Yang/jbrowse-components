import { ErrorMessage } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Button, Container, Grid, TextField } from '@mui/material'
import { observer } from 'mobx-react'
import { useState } from 'react'

import type { SingleCellViewModel } from '../model.ts'

const useStyles = makeStyles()(theme => ({
  importFormContainer: {
    padding: theme.spacing(6),
  },
}))

const ImportForm = observer(function ImportForm({
  model,
}: {
  model: SingleCellViewModel
}) {
  const { classes } = useStyles()
  const { error } = model
  const [datasetUri, setDatasetUri] = useState('')

  return (
    <Container className={classes.importFormContainer}>
      {error ? (
        <Grid container spacing={1} justifyContent="center" alignItems="center">
          <ErrorMessage error={error} />
        </Grid>
      ) : null}
      <Grid container spacing={2} justifyContent="center" alignItems="center">
        <Grid>
          <TextField
            label="Single-cell dataset URL (Zarr directory)"
            value={datasetUri}
            onChange={event => {
              model.setError(undefined)
              setDatasetUri(event.target.value)
            }}
            placeholder="https://example.com/pbmc.zarr"
            style={{ minWidth: 400 }}
          />
        </Grid>
        <Grid>
          <Button
            disabled={!datasetUri}
            onClick={() => {
              model.setError(undefined)
              model.setDataset(datasetUri)
            }}
            variant="contained"
            color="primary"
          >
            Open
          </Button>
        </Grid>
      </Grid>
    </Container>
  )
})

export default ImportForm
