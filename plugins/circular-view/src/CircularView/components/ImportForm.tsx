import { useEffect, useState } from 'react'

import {
  AssemblySelector,
  ErrorMessage,
  SpeciesSelector,
} from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Button, Container, Grid } from '@mui/material'
import { observer } from 'mobx-react'

import type { CircularViewModel } from '../model.ts'

const useStyles = makeStyles()(theme => ({
  importFormContainer: {
    padding: theme.spacing(6),
  },
}))

const ImportForm = observer(function ImportForm({
  model,
}: {
  model: CircularViewModel
}) {
  const { classes } = useStyles()
  const session = getSession(model)
  const { error } = model
  const { assemblyNames, assemblyManager } = session
  const [selectedAsm, setSelectedAsm] = useState(assemblyNames[0]!)
  const [selectedSpecies, setSelectedSpecies] = useState('')
  const assembly = assemblyManager.get(selectedAsm)

  useEffect(() => {
    const assembly = assemblyManager.get(selectedAsm)
    if (selectedSpecies && assembly?.species !== selectedSpecies) {
      const first = assemblyNames.find(
        name => assemblyManager.get(name)?.species === selectedSpecies,
      )
      const next = first || ''
      if (next !== selectedAsm) {
        setSelectedAsm(next)
      }
    }
  }, [selectedSpecies, selectedAsm, assemblyNames, assemblyManager])

  const assemblyError = assemblyNames.length
    ? assembly?.error
    : 'No configured assemblies'
  const regions = assembly?.regions || []
  const err = assemblyError || error

  return (
    <Container className={classes.importFormContainer}>
      {err ? (
        <Grid container spacing={1} justifyContent="center" alignItems="center">
          <ErrorMessage error={err} />
        </Grid>
      ) : null}
      <Grid container spacing={1} justifyContent="center" alignItems="center">
        <SpeciesSelector
          session={session}
          selected={selectedSpecies}
          onChange={val => {
            setSelectedSpecies(val)
          }}
        />
        <AssemblySelector
          onChange={val => {
            model.setError(undefined)
            setSelectedAsm(val)
          }}
          species={selectedSpecies}
          session={session}
          selected={selectedAsm}
        />
        <Button
          disabled={!regions.length}
          onClick={() => {
            model.setError(undefined)
            model.setDisplayedRegions(regions)
          }}
          variant="contained"
          color="primary"
        >
          {/* if there's an error, it's not actively loading  so just display open */}
          {regions.length || err ? 'Open' : 'Loading...'}
        </Button>
      </Grid>
    </Container>
  )
})

export default ImportForm
