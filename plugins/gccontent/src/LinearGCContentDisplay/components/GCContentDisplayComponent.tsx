import { lazy } from 'react'

import { getBpDisplayStr } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

const LazyWiggleDisplayComponent = lazy(() =>
  import('@jbrowse/plugin-wiggle').then(m => ({
    default: m.LinearWiggleDisplayReactComponent,
  })),
)

const useStyles = makeStyles()(theme => ({
  resolution: {
    position: 'absolute',
    right: 4,
    top: 2,
    padding: '0 4px',
    fontSize: 10,
    lineHeight: '14px',
    color: theme.palette.text.secondary,
    backgroundColor: theme.palette.background.paper,
    opacity: 0.85,
    borderRadius: 2,
    pointerEvents: 'none',
    whiteSpace: 'nowrap',
  },
}))

/**
 * the wiggle display that the GC content displays render, plus the size of the
 * GC content calculation window (the resolution) so that the number of bases
 * behind each point of the plot is visible
 */
const GCContentDisplayComponent = observer(function GCContentDisplayComponent({
  model,
}: {
  /** the GC content display model, loosely typed like other display components */
  model: any
}) {
  const { classes } = useStyles()
  return (
    <div style={{ position: 'relative' }}>
      <LazyWiggleDisplayComponent model={model} />
      <div className={classes.resolution} data-testid="gc-content-resolution">
        resolution: {getBpDisplayStr(model.windowSizeSetting as number)}
      </div>
    </div>
  )
})

export default GCContentDisplayComponent
