import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react'

import { AssemblySelector, SpeciesSelector } from '@jbrowse/core/ui'
import { getSession, notEmpty } from '@jbrowse/core/util'
import { cx, makeStyles } from '@jbrowse/core/util/tss-react'
import { Button, IconButton, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'

import { ChevronRightIcon, CloseIcon, LinkIcon } from '@jbrowse/core/ui/Icons'

import type { LinearSyntenyViewModel } from '../../model.ts'

const useStyles = makeStyles()(theme => ({
  mb: {
    marginBottom: 10,
  },
  button: {
    margin: theme.spacing(2),
  },
  rowsContainer: {
    position: 'relative',
    // reserve a gutter on the right for the "]" brackets and circles so the
    // full-width input fields never overlap them
    paddingRight: 36,
  },
  // "]" shaped bracket on the right side, spanning from the vertical middle
  // of row idx's input fields to the vertical middle of row idx + 1's input
  // fields, inset slightly so adjacent pairs' ticks don't touch. top/height
  // are set inline from measured geometry.
  bracket: {
    position: 'absolute',
    right: 14,
    width: 14,
    borderTop: `1px solid ${theme.palette.grey[400]}`,
    borderRight: `1px solid ${theme.palette.grey[400]}`,
    borderBottom: `1px solid ${theme.palette.grey[400]}`,
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
    pointerEvents: 'none',
  },
  bracketSelected: {
    borderColor: theme.palette.primary.main,
  },
  // clickable circle centered on the bracket's vertical line, at the
  // junction between the two rows of the pair. top is set inline from
  // measured geometry.
  synCircle: {
    position: 'absolute',
    right: 14,
    transform: 'translate(50%, -50%)',
    width: 28,
    height: 28,
    padding: 0,
    zIndex: 1,
    backgroundColor: theme.palette.grey[400],
    color: theme.palette.common.white,
    '&:hover': {
      backgroundColor: theme.palette.grey[600],
    },
  },
  synCircleSelected: {
    backgroundColor: theme.palette.primary.main,
    '&:hover': {
      backgroundColor: theme.palette.primary.dark,
    },
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

  // measured vertical centers of each row's input fields, relative to the
  // rows container, used to draw the "]" brackets exactly aligned with the
  // input fields rather than the row container (which also contains the
  // "Row N:" label and helper texts)
  const containerRef = useRef<HTMLDivElement>(null)
  const selectorsRefs = useRef(new Map<number, HTMLDivElement>())
  const [pairGeometry, setPairGeometry] = useState<
    ({ top: number; height: number } | undefined)[]
  >([])

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }
    const update = () => {
      const containerTop = container.getBoundingClientRect().top
      const centers = selectedAssemblyNames.map((_, idx) => {
        const el = selectorsRefs.current.get(idx)
        if (!el) {
          return undefined
        }
        const r = el.getBoundingClientRect()
        return r.top + r.height / 2 - containerTop
      })
      const next = centers.slice(0, -1).map((a, idx) => {
        const b = centers[idx + 1]
        // inset both ends so that adjacent pairs' horizontal ticks, which
        // would otherwise meet at the shared row's input midpoint, keep a
        // visible gap. The circle midpoint (a + b) / 2 is unaffected.
        const inset = 8
        return a === undefined || b === undefined
          ? undefined
          : { top: a + inset, height: b - a - inset * 2 }
      })
      // avoid setState with identical geometry, which would loop since this
      // effect runs after every render
      setPairGeometry(prev =>
        prev.length === next.length &&
        prev.every(
          (p, i) =>
            p === next[i] ||
            (p && next[i] && p.top === next[i].top && p.height === next[i].height),
        )
          ? prev
          : next,
      )
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(container)
    for (const el of selectorsRefs.current.values()) {
      observer.observe(el)
    }
    return () => {
      observer.disconnect()
    }
  })

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

  return (
    <div ref={containerRef} className={classes.rowsContainer}>
      {selectedAssemblyNames.map((assemblyName, idx) => (
        <div key={`${assemblyName}-${idx}`}>
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
          <div
            ref={el => {
              if (el) {
                selectorsRefs.current.set(idx, el)
              } else {
                selectorsRefs.current.delete(idx)
              }
            }}
          >
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
              label="Genome"
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
          </div>
        </div>
      ))}
      {pairGeometry.map((geom, idx) =>
        geom ? (
          <Fragment key={`pair-${idx}`}>
            <div
              className={cx(
                classes.bracket,
                idx === selectedRow ? classes.bracketSelected : undefined,
              )}
              style={{ top: geom.top, height: geom.height }}
            />
            <Tooltip title="Click to configure synteny track for this row pair">
              <IconButton
                data-testid="synbutton"
                className={cx(
                  classes.synCircle,
                  idx === selectedRow ? classes.synCircleSelected : undefined,
                )}
                style={{ top: geom.top + geom.height / 2 }}
                onClick={() => {
                  setSelectedRow(idx)
                }}
              >
                {rowNeedsConfiguration(model, idx) ? (
                  <ChevronRightIcon fontSize="small" />
                ) : (
                  <LinkIcon fontSize="small" />
                )}
              </IconButton>
            </Tooltip>
          </Fragment>
        ) : null,
      )}
    </div>
  )
})

const LeftPanel = observer(function LeftPanel({
  model,
  selectedAssemblyNames,
  setSelectedAssemblyNames,
  selectedRow,
  setSelectedRow,
  onLaunch,
}: {
  model: LinearSyntenyViewModel
  selectedAssemblyNames: string[]
  setSelectedAssemblyNames: (names: string[]) => void
  selectedRow: number
  setSelectedRow: (row: number) => void
  onLaunch: () => void
}) {
  const { classes } = useStyles()
  const numRowPairs = selectedAssemblyNames.length - 1
  const canLaunch =
    !selectedAssemblyNames.some(name => !name) &&
    !Array.from({ length: numRowPairs }, (_, i) => i).some(i =>
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
            setSelectedAssemblyNames([...selectedAssemblyNames, ''])
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
