import { useEffect, useState } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Box, OutlinedInput, Slider, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import SliderTooltip from './SliderTooltip.tsx'

const useStyles = makeStyles()(theme => ({
  container: {
    display: 'flex',
    alignItems: 'center',
    marginLeft: 16,
    marginRight: 16,
    minWidth: 260,
  },
  label: {
    marginRight: 8,
    whiteSpace: 'nowrap',
  },
  slider: {
    flex: 1,
    minWidth: 120,
    marginRight: 12,
    // gray track, rail, and tick marks keep focus on the colored thumb
    '& .MuiSlider-rail': {
      backgroundColor: theme.palette.grey[400],
      opacity: 1,
    },
    '& .MuiSlider-track': {
      backgroundColor: theme.palette.grey[400],
      borderColor: theme.palette.grey[400],
    },
    // circular tick marks, slightly smaller than the thumb
    '& .MuiSlider-mark': {
      width: 6,
      height: 6,
      borderRadius: '50%',
      backgroundColor: theme.palette.grey[500],
      '&.MuiSlider-markActive': {
        backgroundColor: theme.palette.grey[500],
        opacity: 1,
      },
    },
  },
  input: {
    width: 76,
    '& input': {
      padding: '3px 6px',
      fontSize: 12,
      textAlign: 'center',
    },
  },
}))

// fraction of the position range within which the thumb is magnetically
// pulled onto a tick; elsewhere the drag is continuous
export const SNAP_FRACTION = 0.02

export function snapToTick(pos: number, ticks: number[], radius: number) {
  let best = pos
  let bestDist = radius
  for (const t of ticks) {
    const d = Math.abs(pos - t)
    if (d <= bestDist) {
      best = t
      bestDist = d
    }
  }
  return best
}

const identity = (v: number) => v

const SnappingSlider = observer(function SnappingSlider({
  label,
  values,
  value,
  onChange,
  onChangeCommitted,
  format,
  parse = s => {
    const n = Number(s)
    return Number.isFinite(n) ? n : undefined
  },
  toPos = identity,
  fromPos = identity,
}: {
  label: string
  // ascending key values the drag snaps to; need not be evenly spaced
  values: number[]
  // current real value; may lie between key values
  value: number
  onChange?: (value: number) => void
  onChangeCommitted: (value: number) => void
  format: (value: number) => string
  parse?: (text: string) => number | undefined
  // map real values to slider positions and back; ticks are placed at
  // toPos(key) so spacing on screen reflects value magnitude (e.g. log).
  // Must be monotonic inverses of each other; defaults to identity
  toPos?: (value: number) => number
  fromPos?: (pos: number) => number
}) {
  const { classes } = useStyles()
  const [text, setText] = useState(format(value))
  // position while dragging; magnetic snap is applied live so the thumb
  // visibly hops onto ticks instead of jumping on release
  const [dragPos, setDragPos] = useState<number>()
  const min = toPos(values[0]!)
  const max = toPos(values.at(-1)!)
  const ticks = values.map(toPos)
  const snapRadius = (max - min) * SNAP_FRACTION
  const pos = dragPos ?? toPos(value)

  // positions produced by snapToTick are exact tick positions, so map them
  // back to the original key values instead of inverting the transform
  // (avoids floating-point round-trip error like 1000 -> 999.999)
  const posToValue = (p: number) => {
    const i = ticks.indexOf(p)
    return i === -1 ? fromPos(p) : values[i]!
  }

  useEffect(() => {
    setText(format(value))
  }, [value, format])

  const commitText = () => {
    const parsed = parse(text)
    if (parsed === undefined) {
      setText(format(value))
    } else {
      const clamped = Math.min(values.at(-1)!, Math.max(values[0]!, parsed))
      onChangeCommitted(clamped)
      setText(format(clamped))
    }
  }

  return (
    <Box className={classes.container}>
      <Typography variant="body2" className={classes.label}>
        {label}
      </Typography>
      <Slider
        className={classes.slider}
        value={pos}
        onChange={(_, raw) => {
          const snapped = snapToTick(raw as number, ticks, snapRadius)
          setDragPos(snapped)
          onChange?.(posToValue(snapped))
        }}
        onChangeCommitted={(_, raw) => {
          const snapped = snapToTick(raw as number, ticks, snapRadius)
          setDragPos(undefined)
          onChangeCommitted(posToValue(snapped))
        }}
        min={min}
        max={max}
        step={null}
        marks={ticks.map(t => ({ value: t }))}
        valueLabelDisplay="auto"
        valueLabelFormat={p => format(posToValue(p as number))}
        size="small"
        slots={{
          valueLabel: SliderTooltip,
        }}
      />
      <OutlinedInput
        className={classes.input}
        value={text}
        onChange={event => {
          setText(event.target.value)
        }}
        onBlur={commitText}
        onKeyDown={event => {
          if (event.key === 'Enter') {
            commitText()
          } else if (event.key === 'Escape') {
            setText(format(value))
          }
        }}
        size="small"
        inputProps={{ 'aria-label': label }}
      />
    </Box>
  )
})

export default SnappingSlider
