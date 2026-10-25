import { SanitizedHTML } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { getTrackName } from '@jbrowse/core/util/tracks'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

import type { LinearGenomeViewModel } from '../index.ts'
import type { BaseTrackModel } from '@jbrowse/core/pluggableElementTypes/models'

const useStyles = makeStyles()(theme => ({
  root: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: 20,
    cursor: 'grab',
    userSelect: 'none',
    position: 'relative',
  },
  trackName: {
    fontSize: '0.75rem',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    pointerEvents: 'none',
  },
  // extra info a display wants to show next to the track name (e.g. the GC
  // content window size). absolute so that the track name stays centered, and
  // capped at 45% width so that it can't run into the name
  trackInfo: {
    position: 'absolute',
    left: 2,
    maxWidth: '45%',
    fontSize: '0.75rem',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    pointerEvents: 'none',
    color: theme.palette.text.secondary,
  },
}))

type LGV = LinearGenomeViewModel

/** a display can provide a line of text for the left end of the track label */
interface DisplayWithTrackLabelLeftText {
  trackLabelLeftText?: string
}

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
  const display = track.displays[0] as DisplayWithTrackLabelLeftText | undefined
  const trackLabelLeftText = display?.trackLabelLeftText

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
      {trackLabelLeftText ? (
        <span className={classes.trackInfo} data-testid="track-label-info">
          {trackLabelLeftText}
        </span>
      ) : null}
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
