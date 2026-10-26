import { Suspense, lazy, useEffect, useRef } from 'react'

import { getSession } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import Paper from '@mui/material/Paper'
import { observer } from 'mobx-react'

import TrackContainer from './TrackContainer.tsx'
import TracksContainer from './TracksContainer.tsx'

import type { LinearGenomeViewModel } from '../index.ts'

// lazies
const NoTracksActiveButton = lazy(() => import('./NoTracksActiveButton.tsx'))

const useStyles = makeStyles()(theme => ({
  root: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
  },
  header: {
    background: theme.palette.background.paper,
    zIndex: 850,
  },
  tracksContainer: {
    flex: 1,
    minHeight: 0,
  },
}))

const LinearGenomeViewContainer = observer(function LinearGenomeViewContainer({
  model,
}: {
  model: LinearGenomeViewModel
}) {
  const { pinnedTracks, tracks, unpinnedTracks } = model
  const { classes } = useStyles()
  const session = getSession(model)
  const ref = useRef<HTMLDivElement>(null)
  const MiniControlsComponent = model.MiniControlsComponent()
  const HeaderComponent = model.HeaderComponent()
  useEffect(() => {
    // sets the focused view id based on a click within the LGV;
    // necessary for subviews to be focused properly
    function handleSelectView(e: Event) {
      if (e.target instanceof Element && ref.current?.contains(e.target)) {
        session.setFocusedViewId?.(model.id)
      }
    }

    document.addEventListener('mousedown', handleSelectView)
    document.addEventListener('keydown', handleSelectView)
    return () => {
      document.removeEventListener('mousedown', handleSelectView)
      document.removeEventListener('keydown', handleSelectView)
    }
  }, [session, model])

  return (
    <div
      className={classes.root}
      ref={ref}
      // NOTE: the session-wide `hovered` producer that used to live here was
      // removed: nothing consumes `session.hovered`, and the old handler did a
      // `tracks.find(...featureUnderMouse)` scan (and allocated a new object)
      // on every mouse move, re-rendering this container while hovering.
    >
      <div className={classes.header}>
        <HeaderComponent model={model} />
        <MiniControlsComponent model={model} />
      </div>
      <TracksContainer
        model={model}
        className={classes.tracksContainer}
        pinnedTracks={
          pinnedTracks.length ? (
            <Paper elevation={6}>
              {pinnedTracks.map(track => (
                <TrackContainer key={track.id} model={model} track={track} />
              ))}
            </Paper>
          ) : null
        }
      >
        {!tracks.length ? (
          <Suspense fallback={null}>
            <NoTracksActiveButton model={model} />
          </Suspense>
        ) : (
          unpinnedTracks.map(track => (
            <TrackContainer key={track.id} model={model} track={track} />
          ))
        )}
      </TracksContainer>
    </div>
  )
})

export default LinearGenomeViewContainer
