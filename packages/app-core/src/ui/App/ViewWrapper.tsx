import { Suspense } from 'react'

// ui elements
import LoadingEllipses from '@jbrowse/core/ui/LoadingEllipses'
import { getEnv } from '@jbrowse/core/util'
import { cx, makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import type {
  AbstractViewModel,
  SessionWithFocusedViewAndDrawerWidgets,
} from '@jbrowse/core/util'

const useStyles = makeStyles()({
  root: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    overflow: 'hidden',
    '& > *': {
      flex: 1,
    },
  },
})

const ViewWrapper = observer(function ViewWrapper({
  view,
  session,
  panelId,
}: {
  view: AbstractViewModel
  session: SessionWithFocusedViewAndDrawerWidgets
  panelId?: string
}) {
  const { classes } = useStyles()
  const { pluginManager } = getEnv(session)
  const viewType = pluginManager.getViewType(view.type)
  if (!viewType) {
    throw new Error(`unknown view type ${view.type}`)
  }
  const { ReactComponent } = viewType
  if (view.minimized) {
    return null
  }

  return (
    <Suspense fallback={<LoadingEllipses variant="h6" />}>
      <div className={cx(panelId && classes.root)}>
        <ReactComponent model={view} session={session} />
      </div>
    </Suspense>
  )
})

export default ViewWrapper
