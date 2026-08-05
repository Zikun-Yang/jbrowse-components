import { lazy } from 'react'

import { IconButton, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'

import { HelpOutlineIcon as HelpOutline } from '@jbrowse/core/ui/Icons'

import type { SessionWithFocusedViewAndDrawerWidgets } from '@jbrowse/core/util/types'

const DrawerHeaderHelpDialog = lazy(
  () => import('./DrawerHeaderHelpDialog.tsx'),
)

const DrawerHeaderHelpButton = observer(function DrawerHeaderHelpButton({
  session,
  helpText,
}: {
  session: SessionWithFocusedViewAndDrawerWidgets
  helpText: React.ReactNode
}) {
  return (
    <Tooltip title="Help">
      <IconButton
        color="inherit"
        onClick={() => {
          session.queueDialog(handleClose => [
            DrawerHeaderHelpDialog,
            {
              onClose: handleClose,
              helpText,
            },
          ])
        }}
      >
        <HelpOutline />
      </IconButton>
    </Tooltip>
  )
})

export default DrawerHeaderHelpButton
