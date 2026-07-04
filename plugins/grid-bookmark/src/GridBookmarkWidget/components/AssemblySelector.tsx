import {
  Checkbox,
  FormControl,
  InputLabel,
  ListItemText,
  MenuItem,
  OutlinedInput,
  Select,
} from '@mui/material'
import { readConfObject } from '@jbrowse/core/configuration'
import { getSession } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import type { GridBookmarkModel } from '../model.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

const AssemblySelector = observer(function AssemblySelector({
  model,
  species,
}: {
  model: GridBookmarkModel
  species?: string
}) {
  const { validAssemblies, selectedAssemblies } = model
  const session = getSession(model)
  const filteredAssemblies = species
    ? [...validAssemblies].filter(name => {
        const assembly = session.assemblies.find(
          asm => (readConfObject(asm, 'name') as string) === name,
        )
        return (
          (readConfObject(
            assembly as AnyConfigurationModel,
            'species',
          ) as string) === species
        )
      })
    : [...validAssemblies]
  const noAssemblies = filteredAssemblies.length === 0
  const label = 'Select assemblies'
  const id = 'select-assemblies-label'
  const selectedSet = new Set(selectedAssemblies)
  const isAllSelected = filteredAssemblies.every(e => selectedSet.has(e))

  return (
    <FormControl disabled={noAssemblies} fullWidth>
      <InputLabel id={id}>{label}</InputLabel>
      <Select
        labelId={id}
        multiple
        value={selectedAssemblies}
        onChange={event => {
          model.setSelectedAssemblies(
            typeof event.target.value === 'string'
              ? [event.target.value]
              : event.target.value,
          )
        }}
        input={<OutlinedInput label={label} />}
        renderValue={selected => selected.join(', ')}
      >
        <MenuItem
          onClickCapture={event => {
            // onClickCapture allows us to avoid the parent Select onChange
            // from triggering
            model.setSelectedAssemblies(isAllSelected ? [] : filteredAssemblies)
            event.preventDefault()
          }}
        >
          <Checkbox
            checked={isAllSelected}
            indeterminate={!isAllSelected && selectedAssemblies.length > 0}
          />
          <ListItemText primary="Select all" />
        </MenuItem>
        {filteredAssemblies.map(name => (
          <MenuItem key={name} value={name}>
            <Checkbox checked={selectedAssemblies.includes(name)} />
            <ListItemText primary={name} />
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  )
})

export default AssemblySelector
