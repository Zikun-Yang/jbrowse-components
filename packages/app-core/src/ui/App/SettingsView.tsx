import { makeStyles } from '@jbrowse/core/util/tss-react'
import {
  Checkbox,
  FormControlLabel,
  FormGroup,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import type { ThemeOptions } from '@mui/material'

const useStyles = makeStyles()(theme => ({
  root: {
    flex: 1,
    overflowY: 'auto',
    padding: '48px 56px',
    background: theme.palette.background.paper,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: 600,
    letterSpacing: '-0.02em',
    color: theme.palette.text.primary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: theme.palette.text.secondary,
  },
  section: {
    borderTop: `1px solid ${theme.palette.divider}`,
    padding: '32px 0',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: theme.palette.text.secondary,
    marginBottom: 16,
  },
  field: {
    minWidth: 240,
    marginBottom: 16,
  },
}))

interface SettingsSession {
  allThemes?: () => Record<string, ThemeOptions & { name?: string }>
  themeName?: string
  setThemeName?: (arg: string) => void
  stickyViewHeaders?: boolean
  setStickyViewHeaders?(sticky: boolean): void
}

const SettingsView = observer(function SettingsView({
  session,
}: {
  session: SettingsSession
}) {
  const { classes } = useStyles()
  const { stickyViewHeaders = false, setStickyViewHeaders } = session

  return (
    <div className={classes.root}>
      <div className={classes.header}>
        <Typography className={classes.title}>Settings</Typography>
        <Typography className={classes.subtitle}>
          Customize your JBrowse workspace preferences.
        </Typography>
      </div>

      {session.allThemes && session.setThemeName ? (
        <div className={classes.section}>
          <Typography className={classes.sectionTitle}>Appearance</Typography>
          <TextField
            select
            label="Theme"
            value={session.themeName}
            onChange={event => {
              session.setThemeName?.(event.target.value)
            }}
            className={classes.field}
          >
            {Object.entries(session.allThemes()).map(([key, val]) => (
              <MenuItem key={key} value={key}>
                {val.name || '(Unknown name)'}
              </MenuItem>
            ))}
          </TextField>
        </div>
      ) : null}

      <div className={classes.section}>
        <Typography className={classes.sectionTitle}>Workspace</Typography>
        <FormGroup>
          {session.setStickyViewHeaders ? (
            <FormControlLabel
              control={<Checkbox checked={stickyViewHeaders} />}
              label="Keep view header visible"
              onChange={(_, checked) => {
                setStickyViewHeaders?.(checked)
              }}
            />
          ) : null}
        </FormGroup>
      </div>
    </div>
  )
})

export default SettingsView
