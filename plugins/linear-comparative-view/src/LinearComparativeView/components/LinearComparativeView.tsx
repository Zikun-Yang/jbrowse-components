import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import Header from './Header.tsx'
import LinearComparativeRenderArea from './LinearComparativeRenderArea.tsx'
import Rubberband from './Rubberband.tsx'

import type { LinearComparativeViewModel } from '../model.ts'

const useStyles = makeStyles()(theme => ({
  // this helps keep the vertical guide inside the parent view container,
  // similar style exists in the single LGV's trackscontainer. the flex chain
  // gives the render area a bounded height so it can scroll as one unit
  rubberbandContainer: {
    position: 'relative',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
  },

  rubberbandDiv: {
    width: '100%',
    background: theme.palette.action.disabledBackground,
    height: 15,
    '&:hover': {
      background: theme.palette.action.selected,
    },
  },
}))

const LinearComparativeView = observer(function LinearComparativeView({
  model,
}: {
  model: LinearComparativeViewModel
}) {
  const { classes } = useStyles()

  return (
    <div className={classes.rubberbandContainer}>
      <Header model={model} />
      <Rubberband
        model={model}
        ControlComponent={<div className={classes.rubberbandDiv} />}
      />
      <LinearComparativeRenderArea model={model} />
    </div>
  )
})

export default LinearComparativeView
