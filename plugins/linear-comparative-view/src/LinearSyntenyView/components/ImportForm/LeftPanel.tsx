import { useEffect, useState } from 'react'

import { AssemblySelector, SpeciesSelector } from '@jbrowse/core/ui'
import { getSession, notEmpty } from '@jbrowse/core/util'
import { cx, makeStyles } from '@jbrowse/core/util/tss-react'
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos'
import CloseIcon from '@mui/icons-material/Close'
import { Button, IconButton, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'

import type { LinearSyntenyViewModel } from '../../model.ts'

const useStyles = makeStyles()(theme => ({
  mb: {
    marginBottom: 10,
  },
  button: {
    margin: theme.spacing(2),
  },
  rel: {
    position: 'relative',
  },
  synbutton: {
    position: 'absolute',
    top: 30,
  },
  synbuttonNeedsConfig: {
    color: theme.palette.warning.main,
  },
  bg: {
    background: theme.palette.divider,
  },
}))

function rowNeedsConfiguration(model: LinearSyntenyViewModel, idx: number) {
  const selection = model.importFormSyntenyTrackSelections[idx]
  if (!selection) {
    return true
  }
  if (selection.type === 'preConfigured' && !selection.value) {
    return true
  }
  return false
}

const AssemblyRows = observer(function AssemblyRows({
  selectedRow,
  selectedAssemblyNames,
  setSelectedRow,
  setSelectedAssemblyNames,
  model,
}: {
  selectedRow: number
  selectedAssemblyNames: string[]
  setSelectedRow: (idx: number) => void
  setSelectedAssemblyNames: (assemblies: string[]) => void
  model: LinearSyntenyViewModel
}) {
  const { classes } = useStyles()
  const session = getSession(model)
  const { assemblyNames, assemblyManager } = session
  const [selectedSpecies, setSelectedSpecies] = useState<string[]>(
    selectedAssemblyNames.map(() => ''),
  )

  useEffect(() => {
    setSelectedSpecies(prev => {
      const next = [...prev]
      while (next.length < selectedAssemblyNames.length) {
        next.push('')
      }
      return next.slice(0, selectedAssemblyNames.length)
    })
  }, [selectedAssemblyNames.length])

  useEffect(() => {
    selectedAssemblyNames.forEach((assemblyName, idx) => {
      const species = selectedSpecies[idx]
      const assembly = assemblyManager.get(assemblyName)
      if (species && assembly?.species !== species) {
        const first = assemblyNames.find(
          name => assemblyManager.get(name)?.species === species,
        )
        const next = first || ''
        if (next !== assemblyName) {
          setSelectedAssemblyNames(
            selectedAssemblyNames.map((asm, idx2) =>
              idx2 === idx ? next : asm,
            ),
          )
        }
      }
    })
  }, [
    selectedSpecies,
    selectedAssemblyNames,
    assemblyNames,
    assemblyManager,
    setSelectedAssemblyNames,
  ])

  return selectedAssemblyNames.map((assemblyName, idx) => (
    <div key={`${assemblyName}-${idx}`} className={classes.rel}>
      <span>Row {idx + 1}: </span>

      <IconButton
        disabled={selectedAssemblyNames.length <= 2}
        onClick={() => {
          model.importFormRemoveRow(idx)
          setSelectedAssemblyNames(
            selectedAssemblyNames
              .map((asm, idx2) => (idx2 === idx ? undefined : asm))
              .filter(notEmpty),
          )
          setSelectedSpecies(prev => prev.filter((_, idx2) => idx2 !== idx))
          if (selectedRow >= selectedAssemblyNames.length - 2) {
            setSelectedRow(0)
          }
        }}
      >
        <CloseIcon />
      </IconButton>
      <SpeciesSelector
        session={session}
        selected={selectedSpecies[idx]}
        onChange={val => {
          setSelectedSpecies(prev =>
            prev.map((s, idx2) => (idx2 === idx ? val : s)),
          )
        }}
      />
      <AssemblySelector
        helperText=""
        species={selectedSpecies[idx]}
        selected={assemblyName}
        onChange={newAssembly => {
          setSelectedAssemblyNames(
            selectedAssemblyNames.map((asm, idx2) =>
              idx2 === idx ? newAssembly : asm,
            ),
          )
        }}
        session={session}
      />
      {idx !== selectedAssemblyNames.length - 1 ? (
        <Tooltip title="Click to configure synteny track for this row pair">
          <IconButton
            data-testid="synbutton"
            className={cx(
              classes.synbutton,
              idx === selectedRow ? classes.bg : undefined,
              rowNeedsConfiguration(model, idx)
                ? classes.synbuttonNeedsConfig
                : undefined,
            )}
            onClick={() => {
              setSelectedRow(idx)
            }}
          >
            <ArrowForwardIosIcon />
          </IconButton>
        </Tooltip>
      ) : null}
    </div>
  ))
})

const LeftPanel = observer(function LeftPanel({
  model,
  selectedAssemblyNames,
  setSelectedAssemblyNames,
  selectedRow,
  setSelectedRow,
  defaultAssemblyName,
  onLaunch,
}: {
  model: LinearSyntenyViewModel
  selectedAssemblyNames: string[]
  setSelectedAssemblyNames: (names: string[]) => void
  selectedRow: number
  setSelectedRow: (row: number) => void
  defaultAssemblyName: string
  onLaunch: () => void
}) {
  const { classes } = useStyles()
  const numRowPairs = selectedAssemblyNames.length - 1
  const canLaunch = !Array.from({ length: numRowPairs }, (_, i) => i).some(i =>
    rowNeedsConfiguration(model, i),
  )

  return (
    <>
      <div className={classes.mb}>
        Select assemblies for linear synteny view
      </div>
      <AssemblyRows
        model={model}
        selectedAssemblyNames={selectedAssemblyNames}
        setSelectedAssemblyNames={setSelectedAssemblyNames}
        selectedRow={selectedRow}
        setSelectedRow={setSelectedRow}
      />

      <div>
        <Button
          className={classes.button}
          variant="contained"
          color="secondary"
          onClick={() => {
            setSelectedAssemblyNames([
              ...selectedAssemblyNames,
              defaultAssemblyName,
            ])
          }}
        >
          Add row
        </Button>
        <Button
          className={classes.button}
          disabled={!canLaunch}
          onClick={onLaunch}
          variant="contained"
          color="primary"
        >
          Launch
        </Button>
      </div>
    </>
  )
})

export default LeftPanel
