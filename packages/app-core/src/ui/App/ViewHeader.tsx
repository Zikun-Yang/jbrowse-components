import { useEffect, useRef } from 'react'

import { VIEW_HEADER_HEIGHT } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { cx, makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import { KeyboardArrowRightIcon } from '@jbrowse/core/ui/Icons'

import { useDockview } from './DockviewContext.tsx'
import ViewButtons from './ViewButtons.tsx'
import ViewContainerTitle from './ViewContainerTitle.tsx'
import ViewMenu from './ViewMenu.tsx'

import type { IBaseViewModel } from '@jbrowse/core/pluggableElementTypes/models'
import type { Position } from 'dockview-react'

const DRAG_THRESHOLD = 5

function directionToPosition(
  rect: DOMRect,
  clientX: number,
  clientY: number,
): Position {
  const x = clientX - rect.left
  const y = clientY - rect.top
  const nearLeft = x < rect.width * 0.25
  const nearRight = x > rect.width * 0.75
  const nearTop = y < rect.height * 0.25
  const nearBottom = y > rect.height * 0.75

  if (nearLeft) {
    return 'left'
  }
  if (nearRight) {
    return 'right'
  }
  if (nearTop) {
    return 'top'
  }
  if (nearBottom) {
    return 'bottom'
  }
  return 'right'
}

function findPanelIdAtPoint(
  clientX: number,
  clientY: number,
): string | undefined {
  const elements = document.elementsFromPoint(clientX, clientY)
  for (const element of elements) {
    const wrapper = element.closest('[data-panel-id]')
    if (wrapper) {
      return wrapper.getAttribute('data-panel-id') ?? undefined
    }
  }
  return undefined
}

const useStyles = makeStyles()(theme => ({
  icon: {
    color: theme.palette.secondary.contrastText,
  },
  grow: {
    flexGrow: 1,
  },
  viewHeader: {
    display: 'flex',
    height: VIEW_HEADER_HEIGHT,
    top: 0,
    zIndex: 900,
    userSelect: 'none',
  },
  viewHeaderDraggable: {
    cursor: 'grab',
    '&:active': {
      cursor: 'grabbing',
    },
  },
  viewTitle: {
    display: 'flex',
    alignItems: 'center',
  },
}))

const ViewHeader = observer(function ViewHeader({
  view,
  onClose,
  onMinimize,
  className,
  panelId,
}: {
  view: IBaseViewModel
  onClose: () => void
  onMinimize: () => void
  className?: string
  panelId?: string
}) {
  const { classes, cx } = useStyles()
  const scrollRef = useRef<HTMLDivElement>(null)
  const session = getSession(view)
  const { api } = useDockview()

  // scroll the view into view when first mounted. note: this effect will run
  // only once, because of the empty array second param
  useEffect(() => {
    if (
      typeof jest === 'undefined' &&
      !navigator.webdriver &&
      window.self === window.top
    ) {
      scrollRef.current?.scrollIntoView({ block: 'center' })
    }
  }, [])

  const handlePointerDown = (event: React.PointerEvent) => {
    // Only enable dragging when inside a dockview panel and not on interactive
    // elements (buttons, menus, inputs, links)
    if (!api || !panelId) {
      return
    }
    const target = event.target
    if (
      target instanceof Element &&
      target.closest(
        'button, [role="button"], a, input, textarea, select, [contenteditable="true"]',
      )
    ) {
      return
    }

    const startX = event.clientX
    const startY = event.clientY
    let dragging = false

    const handlePointerMove = (e: PointerEvent) => {
      const dx = e.clientX - startX
      const dy = e.clientY - startY
      if (!dragging && Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD) {
        dragging = true
        document.body.style.cursor = 'grabbing'
      }
    }

    const handlePointerUp = (e: PointerEvent) => {
      document.removeEventListener('pointermove', handlePointerMove)
      document.removeEventListener('pointerup', handlePointerUp)
      document.body.style.cursor = ''

      if (!dragging) {
        return
      }

      const sourcePanel = api.getPanel(panelId)
      if (!sourcePanel) {
        return
      }

      const targetPanelId = findPanelIdAtPoint(e.clientX, e.clientY)
      if (!targetPanelId || targetPanelId === panelId) {
        return
      }

      const targetPanel = api.getPanel(targetPanelId)
      if (!targetPanel) {
        return
      }

      const wrapper = document.querySelector(
        `[data-panel-id="${targetPanelId}"]`,
      )
      if (!(wrapper instanceof HTMLElement)) {
        return
      }

      const rect = wrapper.getBoundingClientRect()
      const position = directionToPosition(rect, e.clientX, e.clientY)
      sourcePanel.api.moveTo({ group: targetPanel.group, position })
    }

    document.addEventListener('pointermove', handlePointerMove)
    document.addEventListener('pointerup', handlePointerUp)
  }

  return (
    <div
      ref={scrollRef}
      className={cx(
        classes.viewHeader,
        panelId && classes.viewHeaderDraggable,
        className,
      )}
      onPointerDown={handlePointerDown}
    >
      <ViewMenu model={view} IconProps={{ className: classes.icon }} />
      <div className={classes.grow} />
      <div className={classes.viewTitle}>
        {session.focusedViewId === view.id ? (
          <KeyboardArrowRightIcon className={classes.icon} fontSize="small" />
        ) : null}
        <ViewContainerTitle view={view} />
      </div>
      <div className={classes.grow} />
      <ViewButtons onClose={onClose} onMinimize={onMinimize} view={view} />
    </div>
  )
})

export default ViewHeader
