import { Suspense, lazy, useEffect, useRef } from 'react'

import { Menu } from '@jbrowse/core/ui'
import { getEnv } from '@jbrowse/core/util'
import { cx, makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import Gridlines from './Gridlines.tsx'
import Rubberband from './Rubberband.tsx'
import Scalebar from './Scalebar.tsx'
import VerticalGuide from './VerticalGuide.tsx'
import { SCALE_BAR_HEIGHT } from '../consts.ts'
import { useRangeSelect } from './useRangeSelect.ts'
import { useSideScroll } from './useSideScroll.ts'
import { useWheelScroll } from './useWheelScroll.ts'

import type { LinearGenomeViewModel } from '../index.ts'

const CenterLine = lazy(() => import('./CenterLine.tsx'))
const Highlight = lazy(() => import('./Highlight.tsx'))
const RubberbandSpan = lazy(() => import('./RubberbandSpan.tsx'))

const useStyles = makeStyles()({
  tracksContainer: {
    position: 'relative',
    contain: 'layout style',
    display: 'flex',
    flexDirection: 'column',
  },
  tracksScrollArea: {
    flex: 1,
    minHeight: 0,
    // Internal track scrolling only when the view is inside a dockview panel.
    '[data-panel-id] &': {
      overflowX: 'hidden',
      overflowY: 'auto',
    },
  },
})

type LGV = LinearGenomeViewModel

const TracksContainer = observer(function TracksContainer({
  children,
  model,
  className,
  pinnedTracks,
}: {
  children: React.ReactNode
  model: LGV
  className?: string
  pinnedTracks?: React.ReactNode
}) {
  const { classes, cx } = useStyles()
  const { pluginManager } = getEnv(model)
  const { mouseDown: mouseDown1, mouseUp } = useSideScroll(model)
  const { showGridlines, showCenterLine, isScalebarRefNameMenuOpen } = model
  const ref = useRef<HTMLDivElement>(null)
  const {
    guideX,
    rubberbandOn,
    leftBpOffset,
    rightBpOffset,
    numOfBpSelected,
    width,
    left,
    anchorPosition,
    open,
    isClick,
    clickBpOffset,
    handleMenuItemClick,
    handleClose,
    mouseMove,
    mouseDown: mouseDown2,
  } = useRangeSelect(ref, model, true)
  useWheelScroll(ref, model)

  const additional = pluginManager.evaluateExtensionPoint(
    'LinearGenomeView-TracksContainerComponent',
    undefined,
    { model },
  ) as React.ReactNode

  return (
    <div
      ref={ref}
      data-testid="tracksContainer"
      className={cx(classes.tracksContainer, className)}
      onMouseDown={event => {
        mouseDown1(event)
        mouseDown2(event)
      }}
      onMouseMove={mouseMove}
      onMouseUp={mouseUp}
    >
      {showGridlines ? <Gridlines model={model} /> : null}
      <Suspense fallback={null}>
        {showCenterLine ? <CenterLine model={model} /> : null}
      </Suspense>
      {guideX !== undefined && !isScalebarRefNameMenuOpen ? (
        <VerticalGuide model={model} coordX={guideX} />
      ) : rubberbandOn ? (
        <Suspense fallback={null}>
          <RubberbandSpan
            leftBpOffset={leftBpOffset}
            rightBpOffset={rightBpOffset}
            numOfBpSelected={numOfBpSelected}
            width={width}
            left={left}
          />
        </Suspense>
      ) : null}
      {model.volatileGuides.map((guide, idx) => (
        <VerticalGuide key={idx} model={model} coordX={guide.xPos} />
      ))}
      {anchorPosition ? (
        <Menu
          anchorReference="anchorPosition"
          anchorPosition={{
            left: anchorPosition.clientX,
            top: anchorPosition.clientY,
          }}
          onMenuItemClick={handleMenuItemClick}
          open={open}
          onClose={handleClose}
          menuItems={
            isClick && clickBpOffset
              ? model.rubberbandClickMenuItems(clickBpOffset)
              : model.rubberBandMenuItems()
          }
        />
      ) : null}

      <Rubberband
        model={model}
        ControlComponent={
          <Scalebar
            model={model}
            style={{
              height: SCALE_BAR_HEIGHT,
              boxSizing: 'border-box',
            }}
          />
        }
      />
      <HighlightGroup model={model} />
      {additional}
      {pinnedTracks}
      <div className={classes.tracksScrollArea}>{children}</div>
    </div>
  )
})

const HighlightGroup = observer(function HighlightGroup({
  model,
}: {
  model: LGV
}) {
  return model.highlight.length ? (
    <Suspense fallback={null}>
      {model.highlight.map((highlight, idx) => (
        <Highlight
          key={`${JSON.stringify(highlight)}-${idx}`}
          model={model}
          highlight={highlight}
        />
      ))}
    </Suspense>
  ) : null
})

export default TracksContainer
