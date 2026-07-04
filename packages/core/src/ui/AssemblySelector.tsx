import { useEffect, useMemo } from 'react'

import { Autocomplete, TextField } from '@mui/material'
import { observer } from 'mobx-react'

import { readConfObject } from '../configuration/index.ts'
import { useLocalStorage } from '../util/index.ts'
import { makeStyles } from '../util/tss-react/index.ts'

import type { AbstractSessionModel } from '../util/index.ts'
import type { InputProps as IIP, TextFieldProps as TFP } from '@mui/material'

const useStyles = makeStyles()({
  importFormEntry: {
    minWidth: 180,
  },
})

const AssemblySelector = observer(function AssemblySelector({
  session,
  onChange,
  label = 'Assembly',
  selected,
  species,
  InputProps,
  TextFieldProps,
  localStorageKey,
  helperText = 'Select assembly to view',
}: {
  session: AbstractSessionModel
  label?: string
  helperText?: string
  onChange: (arg: string) => void
  selected?: string
  species?: string
  localStorageKey?: string
  InputProps?: IIP
  TextFieldProps?: TFP
}) {
  const { classes } = useStyles()
  const { assemblies, assemblyNames } = session

  // constructs a localstorage key based on host/path/config to help
  // remember. non-config assists usage with e.g. embedded apps
  const config = new URLSearchParams(window.location.search).get('config')
  const [lastSelected, setLastSelected] = useLocalStorage(
    `lastAssembly-${[
      window.location.host + window.location.pathname,
      config,
      localStorageKey,
    ].join('-')}`,
    selected,
    typeof jest === 'undefined' && Boolean(localStorageKey),
  )

  const assemblyMap = useMemo(() => {
    const map = new Map<
      string,
      { name: string; displayName: string; species: string }
    >()
    for (const assembly of assemblies) {
      const name = readConfObject(assembly, 'name') as string
      const displayName =
        (readConfObject(assembly, 'displayName') as string) || name
      const species = (readConfObject(assembly, 'species') as string) || ''
      map.set(name, { name, displayName, species })
    }
    return map
  }, [assemblies])

  const options = useMemo(
    () =>
      assemblyNames
        .filter(name => {
          const asm = assemblyMap.get(name)
          return !species || asm?.species === species
        })
        .map(name => {
          const asm = assemblyMap.get(name)!
          return {
            name: asm.name,
            displayName: asm.displayName,
          }
        }),
    [assemblyNames, assemblyMap, species],
  )

  const selection =
    options.find(o => o.name === (lastSelected || selected || ''))?.name ||
    options[0]?.name

  useEffect(() => {
    if (selection && selection !== selected) {
      onChange(selection)
    }
  }, [selection, selected, onChange])

  const error = assemblyNames.length ? '' : 'No configured assemblies'
  const value = options.find(o => o.name === selection) || null
  const { slotProps: consumerSlotProps, ...consumerTextFieldProps } =
    TextFieldProps || {}

  return (
    <Autocomplete
      data-testid="assembly-selector-textfield"
      disabled={!!error}
      options={options}
      getOptionLabel={option => option.displayName}
      isOptionEqualToValue={(option, val) => option.name === val.name}
      value={value}
      onChange={(_event, newValue) => {
        if (newValue) {
          setLastSelected(newValue.name)
          onChange(newValue.name)
        }
      }}
      className={classes.importFormEntry}
      renderInput={params => (
        <TextField
          {...params}
          {...consumerTextFieldProps}
          label={label}
          variant="outlined"
          helperText={error || helperText}
          error={!!error}
          disabled={!!error}
          className={classes.importFormEntry}
          slotProps={{
            input: {
              ...params.InputProps,
              ...InputProps,
              ...consumerSlotProps?.input,
            },
            htmlInput: {
              'data-testid': 'assembly-selector',
              ...params.inputProps,
              ...consumerSlotProps?.htmlInput,
            },
          }}
        />
      )}
    />
  )
})

export default AssemblySelector
