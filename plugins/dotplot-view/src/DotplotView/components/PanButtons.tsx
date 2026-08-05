import { makeStyles } from '@jbrowse/core/util/tss-react'
import { IconButton, Paper } from '@mui/material'
import { observer } from 'mobx-react'

import {
  ArrowDropDownIcon as ArrowDropDown,
  ArrowDropUpIcon as ArrowDropUp,
  ArrowLeftIcon as ArrowLeft,
  ArrowRightIcon as ArrowRight,
  ZoomInIcon as ZoomIn,
  ZoomOutIcon as ZoomOut,
} from '@jbrowse/core/ui/Icons'

import type { DotplotViewModel } from '../model.ts'

const useStyles = makeStyles()({
  dpad: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    margin: 0,
    position: 'absolute',
    right: 50,
    zIndex: 500,
    top: 50,
  },
  icon: {
    padding: 0,
    margin: 0,
  },
})

const PanButtons = observer(function PanButtons({
  model,
}: {
  model: DotplotViewModel
}) {
  const { classes } = useStyles()
  return (
    <Paper className={classes.dpad} elevation={6}>
      <div />
      <IconButton
        className={classes.icon}
        onClick={() => {
          model.vview.scroll(100)
        }}
      >
        <ArrowDropUp />
      </IconButton>
      <div />

      <IconButton
        className={classes.icon}
        onClick={() => {
          model.hview.scroll(-100)
        }}
      >
        <ArrowLeft />
      </IconButton>
      <div />
      <IconButton
        className={classes.icon}
        onClick={() => {
          model.hview.scroll(100)
        }}
      >
        <ArrowRight />
      </IconButton>

      <div />
      <IconButton
        className={classes.icon}
        onClick={() => {
          model.vview.scroll(-100)
        }}
      >
        <ArrowDropDown />
      </IconButton>
      <div />
      <IconButton
        className={classes.icon}
        onClick={() => {
          model.zoomIn()
        }}
      >
        <ZoomIn />
      </IconButton>
      <div />
      <IconButton
        className={classes.icon}
        onClick={() => {
          model.zoomOut()
        }}
      >
        <ZoomOut />
      </IconButton>
    </Paper>
  )
})

export default PanButtons
