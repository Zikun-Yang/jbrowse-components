import { SanitizedHTML } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { getTrackName } from '@jbrowse/core/util/tracks'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

import type { LinearGenomeViewModel } from '../index.ts'
import type { BaseTrackModel } from '@jbrowse/core/pluggableElementTypes/models'

const useStyles = makeStyles()({
  root: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: 20,
    cursor: 'grab',
    userSelect: 'none',
  },
  trackName: {
    fontSize: '0.75rem',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    pointerEvents: 'none',
  },
})

type LGV = LinearGenomeViewModel

const TrackLabelContainer = observer(function TrackLabelContainer({
  track,
  view,
}: {
  track: BaseTrackModel
  view: LGV
}) {
  const { classes } = useStyles()
  const session = getSession(track)
  const trackName = getTrackName(track.configuration, session)

  return view.trackLabelsSetting !== 'hidden' ? (
    <div
      className={classes.root}
      draggable
      onDragStart={() => {
        view.setDraggingTrackId(track.id)
      }}
      onDragEnd={() => {
        view.setDraggingTrackId(undefined)
      }}
      onClick={event => {
        // avoid clicks on track label from turning into double-click zoom
        event.stopPropagation()
      }}
      data-testid={`dragHandle-${view.id}-${track.trackId}`}
    >
      <Typography component="span" className={classes.trackName}>
        <SanitizedHTML
          html={[trackName, track.minimized ? '(minimized)' : '']
            .filter(f => !!f)
            .join(' ')}
        />
      </Typography>
    </div>
  ) : null
})

export default TrackLabelContainer
