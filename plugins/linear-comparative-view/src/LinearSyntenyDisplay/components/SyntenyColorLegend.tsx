import { getContainingView } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import type { LinearSyntenyViewModel } from '../../LinearSyntenyView/model.ts'
import type { LinearSyntenyDisplayModel } from '../model.ts'

const useStyles = makeStyles()({
  legend: {
    position: 'absolute',
    top: 4,
    right: 8,
    background: 'rgba(255, 255, 255, 0.85)',
    padding: '2px 6px',
    fontSize: 11,
    lineHeight: 1.4,
    pointerEvents: 'none',
    zIndex: 10,
  },
  bar: {
    height: 8,
    width: 120,
    margin: '2px 0',
  },
  labels: {
    display: 'flex',
    justifyContent: 'space-between',
  },
})

const SyntenyColorLegend = observer(function SyntenyColorLegend({
  model,
}: {
  model: LinearSyntenyDisplayModel
}) {
  const { classes } = useStyles()
  const view = getContainingView(model) as LinearSyntenyViewModel
  const { colorBy } = model

  if (colorBy === 'identity') {
    const hue = model.themePrimaryHue
    return (
      <div className={classes.legend} data-testid="synteny_color_legend">
        <div>Identity</div>
        <div
          className={classes.bar}
          style={{
            background: `linear-gradient(to right, hsl(${hue}, 70%, 45%), hsl(55, 70%, 45%), hsl(0, 70%, 45%))`,
          }}
        />
        <div className={classes.labels}>
          <span>85%</span>
          <span>100%</span>
        </div>
      </div>
    )
  }

  if (colorBy === 'rainbow') {
    const anchor =
      view.views[Math.min(view.rainbowAnchor, view.views.length - 1)]
    const anchorName = anchor?.assemblyNames.join(', ') ?? ''
    return (
      <div className={classes.legend} data-testid="synteny_color_legend">
        <div>Position on {anchorName}</div>
        <div
          className={classes.bar}
          style={{
            background:
              'linear-gradient(to right, hsl(260, 75%, 50%), hsl(195, 75%, 50%), hsl(130, 75%, 50%), hsl(65, 75%, 50%), hsl(0, 75%, 50%))',
          }}
        />
        <div className={classes.labels}>
          <span>5&apos;</span>
          <span>3&apos;</span>
        </div>
      </div>
    )
  }

  return null
})

export default SyntenyColorLegend
