import { useMemo } from 'react'

import { Autocomplete, TextField } from '@mui/material'
import { observer } from 'mobx-react'

import { readConfObject } from '../configuration/index.ts'
import { makeStyles } from '../util/tss-react/index.ts'

import type { AbstractSessionModel } from '../util/index.ts'

const useStyles = makeStyles()({
  importFormEntry: {
    minWidth: 180,
  },
})

const SpeciesSelector = observer(function SpeciesSelector({
  session,
  selected,
  onChange,
  label = 'Species',
  helperText = 'Filter assemblies by species',
}: {
  session: AbstractSessionModel
  selected?: string
  onChange: (arg: string) => void
  label?: string
  helperText?: string
}) {
  const { classes } = useStyles()
  const { assemblies } = session
  const speciesOptions = useMemo(
    () =>
      [
        ...new Set(
          assemblies
            .map(
              assembly => (readConfObject(assembly, 'species') as string) || '',
            )
            .filter((s): s is string => !!s),
        ),
      ].sort(),
    [assemblies],
  )

  if (speciesOptions.length === 0) {
    return null
  }

  return (
    <Autocomplete
      data-testid="species-selector"
      options={speciesOptions}
      value={selected || null}
      onChange={(_event, newValue) => {
        onChange(newValue || '')
      }}
      className={classes.importFormEntry}
      renderInput={params => (
        <TextField
          {...params}
          label={label}
          variant="outlined"
          helperText={helperText}
        />
      )}
    />
  )
})

export default SpeciesSelector
