import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import ViewContainer from './ViewContainer.tsx'

import type { DockviewSessionType } from './types.ts'
import type { AbstractViewModel } from '@jbrowse/core/util'
import type { IDockviewPanelProps } from 'dockview-react'

const useStyles = makeStyles()({
  container: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    background: 'transparent',
  },
  viewWrapper: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
  },
})

export interface JBrowseViewPanelParams {
  panelId: string
  viewId: string
  session?: DockviewSessionType
}

const JBrowseViewPanel = observer(function JBrowseViewPanel({
  params,
}: IDockviewPanelProps<JBrowseViewPanelParams>) {
  const { viewId, session, panelId } = params
  const { classes } = useStyles()

  if (!session) {
    return <div className={classes.container}>Loading...</div>
  }

  const view = session.views.find(
    (v: AbstractViewModel) => v.id === viewId,
  )

  if (!view) {
    return <div className={classes.container} />
  }

  return (
    <div className={classes.container}>
      <div className={classes.viewWrapper} data-panel-id={panelId}>
        <ViewContainer view={view} session={session} panelId={panelId} />
      </div>
    </div>
  )
})

export default JBrowseViewPanel
