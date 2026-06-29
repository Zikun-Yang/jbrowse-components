import {
  CircularProgress,
  IconButton,
  Tooltip,
  Typography,
} from '@mui/material'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import PaletteIcon from '@mui/icons-material/Palette'
import PaletteOutlinedIcon from '@mui/icons-material/PaletteOutlined'
import AddIcon from '@mui/icons-material/Add'
import { makeStyles } from '@jbrowse/core/util/tss-react'

import ExpandArrowsIcon from './ExpandArrowsIcon.tsx'
import HistogramBrush from './HistogramBrush.tsx'
import HistogramTransformToggle from './HistogramTransformToggle.tsx'
import MiniHistogram from './MiniHistogram.tsx'

import type {
  SingleCellViewModel,
  AxisTransforms,
  Transform,
} from '../model.ts'

const useStyles = makeStyles()(theme => ({
  root: {
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(0.75, 1),
    cursor: 'pointer',
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
    },
  },
  name: {
    flex: 1,
    fontSize: 13,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  miniHistContainer: {
    width: 80,
    height: 14,
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionGroup: {
    display: 'flex',
    alignItems: 'center',
    flexShrink: 0,
  },
  actionIcon: {
    padding: 2,
    fontSize: 16,
    color: theme.palette.text.secondary,
  },
  expandedHistogram: {
    padding: theme.spacing(1, 1.5, 1.5),
    backgroundColor: theme.palette.common.white,
  },
}))

function allIndicesSet(n: number): Set<number> {
  const set = new Set<number>()
  for (let i = 0; i < n; i++) {
    set.add(i)
  }
  return set
}

function applyXTransform(
  values: Float32Array | undefined,
  transform: Transform,
): Float32Array | undefined {
  if (!values || transform === 'linear') return values
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

interface FeatureRowProps {
  model: SingleCellViewModel
  name: string
  values?: Float32Array
  isLoading?: boolean
  isExpanded?: boolean
  isColorBy?: boolean
  range?: { min: number; max: number } | null
  palette: string
  onToggleExpand?: () => void
  onColorBy: () => void
  onOpenMenu?: (e: React.MouseEvent<HTMLElement>) => void
  onAdd?: (e: React.MouseEvent<HTMLElement>) => void
  onRangeChange?: (range: { min: number; max: number } | null) => void
  histogramLabel?: string
  showInfo?: boolean
  colorTooltip?: string
  expandedHeader?: React.ReactNode
  transform?: AxisTransforms
  onTransformChange?: (axis: 'x' | 'y', transform: Transform) => void
}

export default function FeatureRow({
  model,
  name,
  values,
  isLoading = false,
  isExpanded = false,
  isColorBy = false,
  range = null,
  palette,
  onToggleExpand,
  onColorBy,
  onOpenMenu,
  onAdd,
  onRangeChange,
  histogramLabel,
  showInfo = false,
  colorTooltip = 'Color by this gene',
  expandedHeader,
  transform = { x: 'linear', y: 'linear' },
  onTransformChange,
}: FeatureRowProps) {
  const { classes } = useStyles()
  const transformedValues = applyXTransform(values, transform.x)

  return (
    <div className={classes.root}>
      <div
        className={classes.row}
        onClick={() => onToggleExpand?.()}
        data-testid={`feature-row-${name}`}
      >
        <Typography className={classes.name} title={name}>
          {name}
        </Typography>

        {showInfo && !isExpanded && (
          <Tooltip title="Gene info (placeholder)">
            <IconButton
              size="small"
              onClick={e => e.stopPropagation()}
              className={classes.actionIcon}
              sx={{ p: 0.25 }}
            >
              <InfoOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}

        {!isExpanded && (
          <div className={classes.miniHistContainer}>
            {isLoading ? (
              <CircularProgress size={12} thickness={5} />
            ) : transformedValues ? (
              <MiniHistogram
                values={transformedValues}
                indices={allIndicesSet(transformedValues.length)}
                palette={palette}
                color={isColorBy ? undefined : '#9e9e9e'}
                width={80}
                height={14}
                bins={20}
                yTransform={transform.y}
              />
            ) : null}
          </div>
        )}

        <div className={classes.actionGroup}>
          {showInfo && isExpanded && (
            <Tooltip title="Gene info (placeholder)">
              <IconButton
                size="small"
                onClick={e => e.stopPropagation()}
                className={classes.actionIcon}
                sx={{ p: 0.25 }}
              >
                <InfoOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}

          {onAdd && (
            <Tooltip title="Add gene to set">
              <IconButton
                size="small"
                onClick={e => {
                  e.stopPropagation()
                  onAdd(e)
                }}
                className={classes.actionIcon}
                sx={{ p: 0.25 }}
              >
                <AddIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}

          {onToggleExpand && (
            <Tooltip title={isExpanded ? 'Collapse' : 'Expand'}>
              <IconButton
                size="small"
                onClick={e => {
                  e.stopPropagation()
                  onToggleExpand()
                }}
                className={classes.actionIcon}
                sx={{ p: 0.25 }}
              >
                <ExpandArrowsIcon expanded={isExpanded} fontSize="small" />
              </IconButton>
            </Tooltip>
          )}

          {onOpenMenu && (
            <Tooltip title="More actions">
              <IconButton
                size="small"
                onClick={e => {
                  e.stopPropagation()
                  onOpenMenu(e)
                }}
                className={classes.actionIcon}
                sx={{ p: 0.25 }}
              >
                <MoreVertIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}

          <Tooltip title={colorTooltip}>
            <IconButton
              size="small"
              onClick={e => {
                e.stopPropagation()
                onColorBy()
              }}
              className={classes.actionIcon}
              sx={{
                p: 0.25,
                color: isColorBy ? 'primary.main' : 'text.secondary',
              }}
            >
              {isColorBy ? (
                <PaletteIcon fontSize="small" />
              ) : (
                <PaletteOutlinedIcon fontSize="small" />
              )}
            </IconButton>
          </Tooltip>
        </div>
      </div>

      {isExpanded && transformedValues ? (
        <div className={classes.expandedHistogram}>
          {expandedHeader}
          {onTransformChange && (
            <HistogramTransformToggle
              xTransform={transform.x}
              yTransform={transform.y}
              onChange={onTransformChange}
            />
          )}
          <HistogramBrush
            values={transformedValues}
            initialRange={range}
            isColorBy={isColorBy}
            label={histogramLabel ?? name}
            palette={palette}
            yTransform={transform.y}
            onChange={nextRange => {
              if (onRangeChange) {
                onRangeChange(nextRange)
              } else if (nextRange) {
                model.setFeatureRange(name, nextRange.min, nextRange.max)
              } else {
                model.clearFeatureRange(name)
              }
            }}
          />
        </div>
      ) : null}
    </div>
  )
}
