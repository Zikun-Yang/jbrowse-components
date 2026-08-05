import { useEffect, useRef, useState } from 'react'

import { ErrorMessage, Menu, ResizeHandle } from '@jbrowse/core/ui'
import { ErrorBoundary } from '@jbrowse/core/ui/ErrorBoundary'
import { cx, makeStyles } from '@jbrowse/core/util/tss-react'
import { isAlive } from '@jbrowse/mobx-state-tree'
import { Paper } from '@mui/material'
import { observer } from 'mobx-react'

import Gridlines from './Gridlines.tsx'
import TrackLabelContainer from './TrackLabelContainer.tsx'
import TrackRenderingContainer from './TrackRenderingContainer.tsx'
import { getTrackMenuItems } from './trackMenuItems.ts'
import { shouldSwapTracks } from './util.ts'

import type { LinearGenomeViewModel } from '../index.ts'
import type { BaseTrackModel } from '@jbrowse/core/pluggableElementTypes/models'

const useStyles = makeStyles()(theme => ({
  root: {
    marginTop: 2,
    overflow: 'hidden',
    position: 'relative',
    contain: 'layout style paint',
  },
  unpinnedTrack: {
    background: 'none',
  },
  resizeHandle: {
    height: 4,
    boxSizing: 'border-box',
    position: 'relative',
    background: 'transparent',
    '&:hover': {
      background: theme.palette.divider,
    },
  },
}))

type LGV = LinearGenomeViewModel

const TrackContainer = observer(function TrackContainer({
  model,
  track,
}: {
  model: LGV
  track: BaseTrackModel
}) {
  const { classes } = useStyles()
  const display = track.displays[0]
  const { draggingTrackId, showTrackOutlines } = model
  const ref = useRef<HTMLDivElement>(null)
  const [contextCoord, setContextCoord] = useState<[number, number]>()

  // while the menu is open, right-clicks land on the MUI modal backdrop rather
  // than the track, so reposition from a global listener instead
  useEffect(() => {
    function globalContextMenu(event: MouseEvent) {
      const el = ref.current
      if (el) {
        const rect = el.getBoundingClientRect()
        if (
          event.clientX >= rect.left &&
          event.clientX <= rect.right &&
          event.clientY >= rect.top &&
          event.clientY <= rect.bottom
        ) {
          event.preventDefault()
          event.stopPropagation()
          setContextCoord([event.clientX, event.clientY])
        }
      }
    }
    if (contextCoord) {
      window.addEventListener('contextmenu', globalContextMenu, true)
      return () => {
        window.removeEventListener('contextmenu', globalContextMenu, true)
      }
    }
    return () => {}
  }, [contextCoord])

  return (
    <Paper
      ref={ref}
      className={cx(classes.root, track.pinned ? null : classes.unpinnedTrack)}
      variant={showTrackOutlines ? 'outlined' : undefined}
      elevation={showTrackOutlines ? undefined : 0}
      onContextMenu={event => {
        event.preventDefault()
        setContextCoord([event.clientX, event.clientY])
      }}
      onClick={event => {
        if (event.detail === 2 && !display.featureIdUnderMouse) {
          const left = ref.current?.getBoundingClientRect().left || 0
          model.zoomTo(model.bpPerPx / 2, event.clientX - left, true)
        }
      }}
      onDragOver={event => {
        if (
          isAlive(display) &&
          draggingTrackId !== undefined &&
          draggingTrackId !== display.id
        ) {
          const draggingIdx = model.tracks.findIndex(
            t => t.id === draggingTrackId,
          )
          const targetIdx = model.tracks.findIndex(t => t.id === track.id)
          const movingDown = targetIdx > draggingIdx
          const currentY = event.clientY

          if (shouldSwapTracks(model.lastTrackDragY, currentY, movingDown)) {
            model.setLastTrackDragY(currentY)
            model.moveTrack(draggingTrackId, track.id)
          }
        }
      }}
    >
      {/* offset 1px since for left track border */}
      {track.pinned ? <Gridlines model={model} offset={1} /> : null}
      <TrackLabelContainer track={track} view={model} />
      <ErrorBoundary FallbackComponent={e => <ErrorMessage error={e.error} />}>
        <TrackRenderingContainer model={model} track={track} />
      </ErrorBoundary>
      <ResizeHandle
        onDrag={display.resizeHeight}
        className={classes.resizeHandle}
      />
      {contextCoord ? (
        <Menu
          open
          onMenuItemClick={(_: unknown, callback: () => void) => {
            callback()
            setContextCoord(undefined)
          }}
          onClose={() => {
            setContextCoord(undefined)
          }}
          anchorReference="anchorPosition"
          anchorPosition={{
            top: contextCoord[1],
            left: contextCoord[0],
          }}
          menuItems={getTrackMenuItems(track)}
        />
      ) : null}
    </Paper>
  )
})

export default TrackContainer
