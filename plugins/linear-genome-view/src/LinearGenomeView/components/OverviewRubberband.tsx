import { useEffect, useRef, useState } from 'react'

import { Menu } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import OverviewRubberbandHoverTooltip from './OverviewRubberbandHoverTooltip.tsx'
import RubberbandSpan from './RubberbandSpan.tsx'
import { getRelativeX } from './util.ts'

import type { LinearGenomeViewModel } from '../index.ts'
import type { Base1DViewModel } from '@jbrowse/core/util/Base1DViewModel'

type LGV = LinearGenomeViewModel

const useStyles = makeStyles()({
  rubberbandControl: {
    cursor: 'crosshair',
    width: '100%',
    minHeight: 8,
  },
  rel: {
    position: 'relative',
  },
})

const OverviewRubberband = observer(function OverviewRubberband({
  model,
  overview,
  ControlComponent = <div />,
}: {
  model: LGV
  overview: Base1DViewModel
  ControlComponent?: React.ReactElement
}) {
  const [startX, setStartX] = useState<number>()
  const [currentX, setCurrentX] = useState<number>()
  const [guideX, setGuideX] = useState<number>()
  const [contextCoord, setContextCoord] = useState<[number, number]>()
  const controlsRef = useRef<HTMLDivElement>(null)
  const { classes } = useStyles()
  const mouseDragging = startX !== undefined

  useEffect(() => {
    function globalMouseMove(event: MouseEvent) {
      const ref = controlsRef.current
      if (ref && mouseDragging) {
        setCurrentX(getRelativeX(event, ref))
      }
    }

    function globalMouseUp() {
      // click and drag
      if (startX !== undefined && currentX !== undefined) {
        if (Math.abs(currentX - startX) > 3) {
          const left = Math.min(startX, currentX)
          const right = Math.max(startX, currentX)
          model.moveTo(overview.pxToBp(left), overview.pxToBp(right))
        }
      }

      // just a click
      if (startX !== undefined && currentX === undefined) {
        const click = overview.pxToBp(startX)
        if (!click.refName) {
          getSession(model).notify('unknown position clicked')
          console.error('unknown position clicked', click)
        } else {
          model.centerAt(Math.round(click.coord), click.refName, click.index)
        }
      }
      setStartX(undefined)
      setCurrentX(undefined)

      if (startX !== undefined) {
        setGuideX(undefined)
      }
    }

    function globalKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setStartX(undefined)
        setCurrentX(undefined)
      }
    }

    if (mouseDragging) {
      window.addEventListener('mousemove', globalMouseMove, true)
      window.addEventListener('mouseup', globalMouseUp, true)
      window.addEventListener('keydown', globalKeyDown, true)
      return () => {
        window.removeEventListener('mousemove', globalMouseMove, true)
        window.removeEventListener('mouseup', globalMouseUp, true)
        window.removeEventListener('keydown', globalKeyDown, true)
      }
    }
    return () => {}
  }, [mouseDragging, currentX, startX, model, overview])

  function mouseDown(event: React.MouseEvent<HTMLDivElement>) {
    if (event.button !== 0) {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    setStartX(getRelativeX(event, controlsRef.current))
  }

  function contextMenu(event: React.MouseEvent<HTMLDivElement>) {
    event.preventDefault()
    setContextCoord([event.clientX, event.clientY])
  }

  // while the menu is open, right-clicks land on the MUI modal backdrop rather
  // than the control div, so reposition from a global listener instead
  useEffect(() => {
    function globalContextMenu(event: MouseEvent) {
      const ref = controlsRef.current
      if (ref) {
        const rect = ref.getBoundingClientRect()
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

  function mouseMove(event: React.MouseEvent<HTMLDivElement>) {
    setGuideX(getRelativeX(event, controlsRef.current))
  }

  function mouseOut() {
    setGuideX(undefined)
  }

  const contextMenuComponent = contextCoord ? (
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
      menuItems={[
        {
          label: 'Show ideogram',
          type: 'checkbox' as const,
          checked: model.showCytobands,
          disabled: !model.anyCytobandsExist,
          onClick: () => {
            model.setShowCytobands(!model.showCytobands)
          },
        },
      ]}
    />
  ) : null

  if (startX === undefined) {
    return (
      <div className={classes.rel}>
        {guideX !== undefined ? (
          <OverviewRubberbandHoverTooltip
            model={model}
            open={!mouseDragging}
            overview={overview}
            guideX={guideX}
          />
        ) : null}
        <div
          className={classes.rubberbandControl}
          ref={controlsRef}
          onMouseDown={mouseDown}
          onMouseOut={mouseOut}
          onMouseMove={mouseMove}
          onContextMenu={contextMenu}
        >
          {ControlComponent}
        </div>
        {contextMenuComponent}
      </div>
    )
  }

  let left = startX || 0
  let width = 0
  if (currentX !== undefined) {
    left = Math.min(currentX, startX)
    width = currentX - startX
  }
  // calculate the start and end bp of drag
  let leftBpOffset: ReturnType<typeof overview.pxToBp> | undefined
  let rightBpOffset: ReturnType<typeof overview.pxToBp> | undefined
  if (startX) {
    leftBpOffset = overview.pxToBp(startX)
    rightBpOffset = overview.pxToBp(startX + width)
    if (currentX !== undefined && currentX < startX) {
      ;[leftBpOffset, rightBpOffset] = [rightBpOffset, leftBpOffset]
    }
  }

  return (
    <div className={classes.rel}>
      {leftBpOffset && rightBpOffset ? (
        <RubberbandSpan
          leftBpOffset={leftBpOffset}
          rightBpOffset={rightBpOffset}
          width={Math.abs(width)}
          left={left}
        />
      ) : null}
      <div
        data-testid="rubberband_controls"
        className={classes.rubberbandControl}
        ref={controlsRef}
        onMouseDown={mouseDown}
        onMouseOut={mouseOut}
        onMouseMove={mouseMove}
        onContextMenu={contextMenu}
      >
        {ControlComponent}
      </div>
      {contextMenuComponent}
    </div>
  )
})

export default OverviewRubberband
