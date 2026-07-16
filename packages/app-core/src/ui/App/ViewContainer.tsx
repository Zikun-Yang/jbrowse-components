import { useEffect } from 'react'

import { useWidthSetter } from '@jbrowse/core/util'
import { cx, makeStyles } from '@jbrowse/core/util/tss-react'
import { Paper, useTheme } from '@mui/material'
import { observer } from 'mobx-react'

import ViewHeader from './ViewHeader.tsx'
import ViewWrapper from './ViewWrapper.tsx'

import type {
  AbstractViewModel,
  SessionWithFocusedViewAndDrawerWidgets,
} from '@jbrowse/core/util'

const useStyles = makeStyles()(theme => ({
  viewContainer: {
    margin: theme.spacing(0.5),
    padding: `0 ${theme.spacing(1)} ${theme.spacing(1)}`,
    overflow: 'clip',
    // xref https://stackoverflow.com/questions/43909940/why-does-overflowhidden-prevent-positionsticky-from-working
    // note that contain:paint also seems to work
  },
  viewContainerPanel: {
    margin: 0,
    padding: 0,
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  viewWrapper: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    overflow: 'hidden',
  },
  focusedView: {
    background: theme.palette.secondary.main,
  },
  unfocusedView: {
    background: theme.palette.secondary.dark,
  },
}))

const ViewContainer = observer(function ViewContainer({
  view,
  session,
  panelId,
}: {
  view: AbstractViewModel
  session: SessionWithFocusedViewAndDrawerWidgets
  panelId?: string
}) {
  const theme = useTheme()
  const ref = useWidthSetter(view, theme.spacing(1))
  const { classes } = useStyles()

  useEffect(() => {
    function handleSelectView(e: Event) {
      if (e.target instanceof Element && ref.current?.contains(e.target)) {
        session.setFocusedViewId(view.id)
      }
    }

    document.addEventListener('mousedown', handleSelectView)
    document.addEventListener('keydown', handleSelectView)
    return () => {
      document.removeEventListener('mousedown', handleSelectView)
      document.removeEventListener('keydown', handleSelectView)
    }
  }, [ref, session, view])

  const backgroundColorClassName =
    session.focusedViewId === view.id
      ? classes.focusedView
      : classes.unfocusedView
  const viewContainerClassName = cx(
    classes.viewContainer,
    !panelId && backgroundColorClassName,
    panelId && classes.viewContainerPanel,
  )

  return (
    <Paper
      ref={ref}
      elevation={panelId ? 0 : 12}
      className={viewContainerClassName}
      data-testid={`view-container-${view.id}`}
    >
      <ViewHeader
        view={view}
        panelId={panelId}
        onClose={() => {
          session.removeView(view)
        }}
        onMinimize={() => {
          view.setMinimized(!view.minimized)
        }}
        className={backgroundColorClassName}
      />
      <Paper elevation={0} className={panelId ? classes.viewWrapper : undefined}>
        <ViewWrapper view={view} session={session} panelId={panelId} />
      </Paper>
    </Paper>
  )
})

export default ViewContainer
