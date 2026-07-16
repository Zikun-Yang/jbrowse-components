import { Suspense, lazy, useEffect, useRef } from 'react'

import { VIEW_HEADER_HEIGHT } from '@jbrowse/core/ui'
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
    top: VIEW_HEADER_HEIGHT,
    zIndex: 850,
  },
  tracksContainer: {
    flex: 1,
    minHeight: 0,
    // Internal track scrolling only when the view is inside a dockview panel.
    '[data-panel-id] &': {
      overflowX: 'hidden',
      overflowY: 'auto',
    },
  },
  pinnedTracks: {
    position: 'sticky',
    zIndex: 3,
  },
}))

const LinearGenomeViewContainer = observer(function LinearGenomeViewContainer({
  model,
}: {
  model: LinearGenomeViewModel
}) {
  const {
    pinnedTracks,
    stickyViewHeaders,
    pinnedTracksTop,
    tracks,
    unpinnedTracks,
  } = model
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
      onMouseLeave={() => {
        session.setHovered(undefined)
      }}
      onMouseMove={event => {
        const c = ref.current
        if (!c) {
          return
        }
        const { tracks } = model
        const leftPx = event.clientX - c.getBoundingClientRect().left
        const hoverPosition = model.pxToBp(leftPx)
        const hoverFeature = tracks.find(t => t.displays[0].featureUnderMouse)
        session.setHovered({ hoverPosition, hoverFeature })
      }}
    >
      <div
        className={classes.header}
        style={{ position: stickyViewHeaders ? 'sticky' : undefined }}
      >
        <HeaderComponent model={model} />
        <MiniControlsComponent model={model} />
      </div>
      <TracksContainer model={model} className={classes.tracksContainer}>
        {!tracks.length ? (
          <Suspense fallback={null}>
            <NoTracksActiveButton model={model} />
          </Suspense>
        ) : (
          <>
            {pinnedTracks.length ? (
              <Paper
                elevation={6}
                className={classes.pinnedTracks}
                style={{ top: pinnedTracksTop }}
              >
                {pinnedTracks.map(track => (
                  <TrackContainer key={track.id} model={model} track={track} />
                ))}
              </Paper>
            ) : null}
            {unpinnedTracks.map(track => (
              <TrackContainer key={track.id} model={model} track={track} />
            ))}
          </>
        )}
      </TracksContainer>
    </div>
  )
})

export default LinearGenomeViewContainer
