import { useMemo, useState } from 'react'
import { observer } from 'mobx-react'
import {
  Box,
  Button,
  Checkbox,
  IconButton,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import PaletteIcon from '@mui/icons-material/Palette'
import { makeStyles } from '@jbrowse/core/util/tss-react'

import HistogramBrush from './HistogramBrush.tsx'
import HistogramTransformToggle from './HistogramTransformToggle.tsx'
import MiniHistogram from './MiniHistogram.tsx'
import MiniStackedBar from './MiniStackedBar.tsx'

import type {
  SingleCellViewModel,
  Transform,
  AxisTransforms,
} from '../model.ts'
import type {
  CategoricalColumn,
  ContinuousColumn,
} from '../../SingleCellAdapter/SingleCellZarrAdapter.ts'

const DEFAULT_TRANSFORM: AxisTransforms = { x: 'linear', y: 'linear' }
const EMPTY_ARRAY: string[] = []

function applyXTransform(
  values: Float32Array,
  transform: Transform,
): Float32Array {
  if (transform === 'linear') return values
  let min = Infinity
  for (const v of values) {
    if (v < min) min = v
  }
  if (!Number.isFinite(min)) return values
  const shift = min < 0 ? -min : 0
  const out = new Float32Array(values.length)
  for (let i = 0; i < values.length; i++) {
    out[i] = Math.log1p(values[i]! + shift)
  }
  return out
}

const useStyles = makeStyles()(theme => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: theme.palette.common.white,
    borderRight: `1px solid ${theme.palette.divider}`,
    overflow: 'hidden',
  },
  topBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing(0.75, 1),
    borderBottom: `1px solid ${theme.palette.divider}`,
    gap: theme.spacing(1),
    backgroundColor: theme.palette.common.white,
  },
  scrollArea: {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
  },
  category: {
    borderBottom: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.common.white,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    padding: theme.spacing(0.5, 1),
    cursor: 'pointer',
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
    },
  },
  headerText: {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontSize: 13,
  },
  expandIcon: {
    color: theme.palette.text.secondary,
    fontSize: 18,
  },
  tintButton: {
    padding: 2,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    '&.active': {
      borderColor: theme.palette.primary.main,
      backgroundColor: theme.palette.primary.light + '22',
    },
  },
  details: {
    paddingLeft: theme.spacing(4),
    paddingRight: theme.spacing(1),
    paddingBottom: theme.spacing(1),
  },
  labelRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    padding: theme.spacing(0.25, 0),
    cursor: 'pointer',
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
    },
  },
  labelName: {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontSize: 12,
  },
  miniBarContainer: {
    width: 100,
    height: 11,
    flexShrink: 0,
  },
  count: {
    color: theme.palette.text.secondary,
    fontVariantNumeric: 'tabular-nums',
    fontSize: 11,
    textAlign: 'right',
    flexShrink: 0,
    paddingLeft: theme.spacing(0.5),
  },
  colorSwatch: {
    width: 11,
    height: 11,
    borderRadius: 2,
    border: `1px solid ${theme.palette.divider}`,
    flexShrink: 0,
  },
}))

const CategoricalCategory = observer(function CategoricalCategory({
  model,
  column,
  col,
  isColorBy,
  selectedLabels,
}: {
  model: SingleCellViewModel
  column: string
  col: CategoricalColumn
  isColorBy: boolean
  selectedLabels: string[]
}) {
  const { classes } = useStyles()
  const [expanded, setExpanded] = useState(false)
  const { data, colorByObsColumn } = model
  const colorByCol = colorByObsColumn
    ? data?.metadata[colorByObsColumn]
    : undefined

  const selectedLabelsSet = useMemo(
    () => new Set(selectedLabels),
    [selectedLabels],
  )

  const colMap = data?.labelToIndices.get(column)

  const allLabels = col.categories
  const allCount = allLabels.length
  const selectedCount = selectedLabelsSet.size
  const checked = selectedCount === allCount && allCount > 0
  const indeterminate = selectedCount > 0 && selectedCount < allCount

  const labelEntries = useMemo(() => {
    if (!colMap) return []
    return allLabels
      .map(label => ({
        label,
        count: colMap.get(label)?.size ?? 0,
      }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
  }, [allLabels, colMap])

  const maxCountChars = useMemo(() => {
    if (labelEntries.length === 0) return 3
    const maxCount = Math.max(...labelEntries.map(e => e.count))
    return maxCount.toLocaleString().length
  }, [labelEntries])

  const handleHeaderCheckboxChange = () => {
    if (checked) {
      model.clearColumnLabels(column)
    } else {
      model.selectAllLabels(column)
    }
  }

  return (
    <div className={classes.category}>
      <div
        className={classes.header}
        onClick={() => setExpanded(e => !e)}
        data-testid={`obs-category-header-${column}`}
      >
        <Checkbox
          size="small"
          checked={checked}
          indeterminate={indeterminate}
          onClick={e => e.stopPropagation()}
          onChange={handleHeaderCheckboxChange}
        />
        <Typography className={classes.headerText}>{column}</Typography>
        {expanded ? (
          <ExpandLessIcon className={classes.expandIcon} />
        ) : (
          <ExpandMoreIcon className={classes.expandIcon} />
        )}
        <IconButton
          size="small"
          className={`${classes.tintButton} ${isColorBy ? 'active' : ''}`}
          onClick={e => {
            e.stopPropagation()
            model.setColorBy(column)
          }}
        >
          <PaletteIcon
            fontSize="small"
            color={isColorBy ? 'primary' : 'action'}
          />
        </IconButton>
      </div>

      {expanded ? (
        <div className={classes.details}>
          {labelEntries.map(({ label, count }) => {
            const isSelected = selectedLabelsSet.has(label)
            const indices = colMap?.get(label)

            const handleMouseEnter = () => {
              if (indices) {
                model.setHighlightedCells(new Set(indices))
              }
            }
            const handleMouseLeave = () => {
              model.setHighlightedCells(new Set())
            }

            return (
              <Box
                key={label}
                className={classes.labelRow}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
              >
                <Checkbox
                  size="small"
                  checked={isSelected}
                  onChange={() => model.toggleLabel(column, label)}
                />
                <Typography className={classes.labelName} title={label}>
                  {label}
                </Typography>
                <div className={classes.miniBarContainer}>
                  <MiniBar
                    colorByCol={colorByCol}
                    indices={indices ?? new Set()}
                    categoricalPalette={model.categoricalPalette}
                    continuousPalette={model.continuousPalette}
                    quantileMode={model.quantileColoring}
                    xTransform={
                      colorByCol?.type === 'continuous'
                        ? (model.obsTransforms.get(colorByObsColumn ?? '')?.x ??
                          'linear')
                        : 'linear'
                    }
                    yTransform={
                      colorByCol?.type === 'continuous'
                        ? (model.obsTransforms.get(colorByObsColumn ?? '')?.y ??
                          'linear')
                        : 'linear'
                    }
                  />
                </div>
                <Typography
                  className={classes.count}
                  style={{ width: `${maxCountChars + 0.5}ch` }}
                >
                  {count.toLocaleString()}
                </Typography>
              </Box>
            )
          })}
        </div>
      ) : null}
    </div>
  )
})

const ContinuousCategory = observer(function ContinuousCategory({
  model,
  column,
  col,
  isColorBy,
  range,
  palette,
}: {
  model: SingleCellViewModel
  column: string
  col: ContinuousColumn
  isColorBy: boolean
  range: { min: number; max: number } | null
  palette: string
}) {
  const { classes } = useStyles()
  const [expanded, setExpanded] = useState(false)
  const transform = model.obsTransforms.get(column) ?? DEFAULT_TRANSFORM

  let min = Infinity
  let max = -Infinity
  for (const v of col.values) {
    if (v < min) min = v
    if (v > max) max = v
  }

  const checked = !!range

  const handleHeaderCheckboxChange = () => {
    if (range) {
      model.clearContinuousRange(column)
    } else if (Number.isFinite(min) && Number.isFinite(max)) {
      model.setContinuousRange(column, min, max)
    }
  }

  const transformedValues = applyXTransform(col.values, transform.x)

  return (
    <div className={classes.category}>
      <div
        className={classes.header}
        onClick={() => setExpanded(e => !e)}
        data-testid={`obs-category-header-${column}`}
      >
        <Checkbox
          size="small"
          checked={checked}
          onClick={e => e.stopPropagation()}
          onChange={handleHeaderCheckboxChange}
        />
        <Typography className={classes.headerText}>{column}</Typography>
        {expanded ? (
          <ExpandLessIcon className={classes.expandIcon} />
        ) : (
          <ExpandMoreIcon className={classes.expandIcon} />
        )}
        <IconButton
          size="small"
          className={`${classes.tintButton} ${isColorBy ? 'active' : ''}`}
          onClick={e => {
            e.stopPropagation()
            model.setColorBy(column)
          }}
        >
          <PaletteIcon
            fontSize="small"
            color={isColorBy ? 'primary' : 'action'}
          />
        </IconButton>
      </div>

      {expanded ? (
        <div className={classes.details}>
          <HistogramTransformToggle
            xTransform={transform.x}
            yTransform={transform.y}
            onChange={(axis, value) =>
              model.setObsTransform(column, axis, value)
            }
          />
          <HistogramBrush
            values={transformedValues}
            initialRange={range}
            isColorBy={isColorBy}
            label={column}
            palette={palette}
            yTransform={transform.y}
            quantileMode={model.quantileColoring}
            onChange={next => {
              if (next) {
                model.setContinuousRange(column, next.min, next.max)
              } else {
                model.clearContinuousRange(column)
              }
            }}
          />
        </div>
      ) : null}
    </div>
  )
})

const ObsSidebar = observer(function ObsSidebar({
  model,
}: {
  model: SingleCellViewModel
}) {
  const { classes } = useStyles()
  const {
    data,
    colorBy,
    selectedLabels,
    selectionMode,
    selectedRanges,
    continuousPalette,
  } = model

  const sortedColumns = useMemo(() => {
    if (!data) return []
    return [...data.obsColumns].sort((a, b) => a.localeCompare(b))
  }, [data])

  if (!data) return null

  return (
    <div
      className={classes.root}
      style={{ width: model.leftSidebarWidth }}
      data-testid="single-cell-obs-sidebar"
    >
      <div className={classes.topBar}>
        <ToggleButtonGroup
          value={selectionMode}
          exclusive
          size="small"
          onChange={(_, value) => {
            if (value) model.setSelectionMode(value)
          }}
        >
          <ToggleButton value="intersection">AND</ToggleButton>
          <ToggleButton value="union">OR</ToggleButton>
        </ToggleButtonGroup>
        <Button size="small" onClick={() => model.clearSelection()}>
          Clear
        </Button>
      </div>

      <div className={classes.scrollArea}>
        {sortedColumns.map(column => {
          const col = data.metadata[column]
          if (!col) return null
          if (col.type === 'string') return null
          if (col.type === 'categorical') {
            return (
              <CategoricalCategory
                key={column}
                model={model}
                column={column}
                col={col}
                isColorBy={colorBy?.kind === 'obs' && colorBy.name === column}
                selectedLabels={selectedLabels.get(column) ?? EMPTY_ARRAY}
              />
            )
          }
          return (
            <ContinuousCategory
              key={column}
              model={model}
              column={column}
              col={col}
              isColorBy={colorBy?.kind === 'obs' && colorBy.name === column}
              range={selectedRanges.get(column) ?? null}
              palette={continuousPalette}
            />
          )
        })}
      </div>
    </div>
  )
})

function MiniBar({
  colorByCol,
  indices,
  categoricalPalette,
  continuousPalette,
  xTransform = 'linear',
  yTransform = 'linear',
  quantileMode = false,
}: {
  colorByCol:
    | { type: 'categorical'; codes: Int32Array; categories: string[] }
    | { type: 'continuous'; values: Float32Array }
    | { type: 'string'; values: string[] }
    | undefined
  indices: Set<number>
  categoricalPalette: string
  continuousPalette: string
  xTransform?: Transform
  yTransform?: Transform
  quantileMode?: boolean
}) {
  if (!colorByCol || indices.size === 0) {
    return <div style={{ width: 100, height: 11 }} />
  }

  if (colorByCol.type === 'categorical') {
    return (
      <MiniStackedBar
        categories={colorByCol.categories}
        codes={colorByCol.codes}
        indices={indices}
        palette={categoricalPalette}
      />
    )
  }

  if (colorByCol.type === 'continuous') {
    return (
      <MiniHistogram
        values={applyXTransform(colorByCol.values, xTransform)}
        indices={indices}
        palette={continuousPalette}
        yTransform={yTransform}
        quantileMode={quantileMode}
      />
    )
  }

  return <div style={{ width: 100, height: 11 }} />
}

export default ObsSidebar
