import { Dialog } from '@jbrowse/core/ui'
import { SettingsView } from '@jbrowse/app-core'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Button, DialogActions, DialogContent } from '@mui/material'
import { observer } from 'mobx-react'

import type { ThemeOptions } from '@mui/material'

const useStyles = makeStyles()(() => ({
  container: {
    width: 800,
  },
}))

const PreferencesDialog = observer(function PreferencesDialog({
  handleClose,
  session,
}: {
  handleClose: () => void
  session: {
    allThemes: () => Record<string, ThemeOptions & { name?: string }>
    themeName?: string
    setThemeName: (arg: string) => void
    stickyViewHeaders: boolean
    setStickyViewHeaders(sticky: boolean): void
  }
}) {
  const { classes } = useStyles()
  return (
    <Dialog title="Preferences" open onClose={handleClose} maxWidth="xl">
      <DialogContent className={classes.container}>
        <SettingsView session={session} />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Close</Button>
      </DialogActions>
    </Dialog>
  )
})

export default PreferencesDialog
