import { makeStyles } from '@jbrowse/core/util/tss-react'
import {
  FormControlLabel,
  MenuItem,
  Switch,
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
  switchLabel: {
    '& .MuiFormControlLabel-label': {
      fontSize: 14,
      color: theme.palette.text.primary,
    },
  },
  helper: {
    fontSize: 13,
    color: theme.palette.text.secondary,
    margin: '4px 0 16px',
    maxWidth: 480,
  },
}))

interface SettingsSession {
  allThemes?: () => Record<string, ThemeOptions & { name?: string }>
  themeName?: string
  setThemeName?: (arg: string) => void
  autoSizeTrackHeight?: boolean
  setAutoSizeTrackHeight?: (arg: boolean) => void
  minAutoTrackHeight?: number
  setMinAutoTrackHeight?: (arg: number) => void
  maxAutoTrackHeight?: number
  setMaxAutoTrackHeight?: (arg: number) => void
}

const SettingsView = observer(function SettingsView({
  session,
}: {
  session: SettingsSession
}) {
  const { classes } = useStyles()

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

      {session.setAutoSizeTrackHeight &&
      session.setMinAutoTrackHeight &&
      session.setMaxAutoTrackHeight ? (
        <div className={classes.section}>
          <Typography className={classes.sectionTitle}>Tracks</Typography>
          <FormControlLabel
            className={classes.switchLabel}
            control={
              <Switch
                checked={session.autoSizeTrackHeight ?? false}
                onChange={event => {
                  session.setAutoSizeTrackHeight?.(event.target.checked)
                }}
              />
            }
            label="Auto-size track height"
          />
          <Typography className={classes.helper}>
            Automatically adjust track heights to fit the features in the
            current view as you browse.
          </Typography>
          <div>
            <TextField
              type="number"
              label="Min auto track height (px)"
              value={session.minAutoTrackHeight ?? 20}
              disabled={!session.autoSizeTrackHeight}
              onChange={event => {
                if (event.target.value !== '') {
                  session.setMinAutoTrackHeight?.(+event.target.value)
                }
              }}
              className={classes.field}
              slotProps={{ htmlInput: { min: 20, step: 10 } }}
            />
          </div>
          <div>
            <TextField
              type="number"
              label="Max auto track height (px)"
              value={session.maxAutoTrackHeight ?? 1000}
              disabled={!session.autoSizeTrackHeight}
              onChange={event => {
                if (event.target.value !== '') {
                  session.setMaxAutoTrackHeight?.(+event.target.value)
                }
              }}
              className={classes.field}
              slotProps={{ htmlInput: { min: 20, step: 100 } }}
            />
          </div>
        </div>
      ) : null}
    </div>
  )
})

export default SettingsView
