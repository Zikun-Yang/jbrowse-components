import { getTickDisplayStr } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

import { HEADER_OVERVIEW_LABEL_HEIGHT } from '../consts.ts'
import { chooseGridPitch } from '../util.ts'

import type { LinearGenomeViewModel } from '../index.ts'
import type { Base1DViewModel } from '@jbrowse/core/util/Base1DViewModel'
import type { ContentBlock } from '@jbrowse/core/util/blockTypes'

const useStyles = makeStyles()({
  scalebarLabel: {
    height: HEADER_OVERVIEW_LABEL_HEIGHT,
    position: 'absolute',
    top: 0,
    left: 0,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    pointerEvents: 'none',
    fontSize: 11,
  },
})

const OverviewScalebarTickLabels = observer(
  function OverviewScalebarTickLabels({
    block,
    scale,
    overview,
    model,
    offsetPx,
  }: {
    model: LinearGenomeViewModel
    scale: number
    block: ContentBlock
    overview: Base1DViewModel
    offsetPx: number
  }) {
    const { classes } = useStyles()
    const { start, end, reversed } = block
    const { majorPitch } = chooseGridPitch(scale, 120, 15)

    const tickLabels = []
    for (let i = 0; i < Math.floor((end - start) / majorPitch); i++) {
      const offsetLabel = (i + 1) * majorPitch
      tickLabels.push(reversed ? end - offsetLabel : start + offsetLabel)
    }
    return tickLabels.map((tickLabel, labelIdx) => (
      <Typography
        key={`${JSON.stringify(block)}-${tickLabel}-${labelIdx}`}
        className={classes.scalebarLabel}
        variant="body2"
        style={{
          transform: `translateX(${offsetPx + ((labelIdx + 1) * majorPitch) / scale}px)`,
        }}
      >
        {getTickDisplayStr(tickLabel, overview.bpPerPx)}
      </Typography>
    ))
  },
)

export default OverviewScalebarTickLabels
