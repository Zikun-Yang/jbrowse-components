import { readConfObject } from '@jbrowse/core/configuration'
import { ErrorMessage } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { getRoot } from '@jbrowse/mobx-state-tree'
import {
  Button,
  Container,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  TextField,
} from '@mui/material'
import { observer } from 'mobx-react'
import { useState } from 'react'

import type { SingleCellViewModel } from '../model.ts'

interface PresetDataset {
  name: string
  uri: string
}

const useStyles = makeStyles()(theme => ({
  importFormContainer: {
    padding: theme.spacing(6),
  },
}))

function usePresetDatasets(model: SingleCellViewModel): PresetDataset[] {
  const root = getRoot(model) as { jbrowse: { configuration: any } }
  const datasets = readConfObject(root.jbrowse.configuration, [
    'SingleCellPlugin',
    'datasets',
  ]) as PresetDataset[] | undefined
  return datasets ?? []
}

const ImportForm = observer(function ImportForm({
  model,
}: {
  model: SingleCellViewModel
}) {
  const { classes } = useStyles()
  const { error } = model
  const [datasetUri, setDatasetUri] = useState('')
  const presets = usePresetDatasets(model)

  return (
    <Container className={classes.importFormContainer}>
      {error ? (
        <Grid container spacing={1} justifyContent="center" alignItems="center">
          <ErrorMessage error={error} />
        </Grid>
      ) : null}
      <Grid container spacing={2} justifyContent="center" alignItems="center">
        {presets.length > 0 ? (
          <Grid>
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Preset dataset</InputLabel>
              <Select
                value=""
                label="Preset dataset"
                onChange={event => {
                  model.setError(undefined)
                  const uri = event.target.value
                  if (uri) {
                    setDatasetUri(uri)
                  }
                }}
              >
                <MenuItem value="">
                  <em>Choose a preset...</em>
                </MenuItem>
                {presets.map(preset => (
                  <MenuItem key={preset.uri} value={preset.uri}>
                    {preset.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        ) : null}
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
            disabled={!datasetUri || model.loading}
            onClick={() => {
              model.loadDataset(datasetUri)
            }}
            variant="contained"
            color="primary"
          >
            {model.loading ? 'Loading...' : 'Open'}
          </Button>
        </Grid>
      </Grid>
    </Container>
  )
})

export default ImportForm
