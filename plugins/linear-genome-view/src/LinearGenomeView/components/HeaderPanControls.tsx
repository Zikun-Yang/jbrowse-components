import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Button, alpha } from '@mui/material'

import { ArrowBackIcon, ArrowForwardIcon } from '@jbrowse/core/ui/Icons'

import { SPACING } from '../consts.ts'

import type { LinearGenomeViewModel } from '../index.ts'

type LGV = LinearGenomeViewModel
const useStyles = makeStyles()(theme => ({
  panButton: {
    background: alpha(theme.palette.background.paper, 0.8),
    color: theme.palette.text.primary,
    margin: SPACING,
    borderColor:
      theme.palette.mode === 'light'
        ? 'rgba(0, 0, 0, 0.23)'
        : 'rgba(255, 255, 255, 0.23)',
    '&:hover': {
      borderColor: theme.palette.text.primary,
    },
  },
}))

export default function HeaderPanControls({ model }: { model: LGV }) {
  const { classes } = useStyles()
  return (
    <>
      <Button
        variant="outlined"
        color="inherit"
        className={classes.panButton}
        onClick={() => {
          model.slide(-0.9)
        }}
      >
        <ArrowBackIcon />
      </Button>
      <Button
        variant="outlined"
        color="inherit"
        className={classes.panButton}
        onClick={() => {
          model.slide(0.9)
        }}
      >
        <ArrowForwardIcon />
      </Button>
    </>
  )
}
