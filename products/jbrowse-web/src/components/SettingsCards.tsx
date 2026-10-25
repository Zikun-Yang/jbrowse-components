import { AssemblyManager } from '@jbrowse/plugin-data-management'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

import { DNA, ExtensionIcon } from '@jbrowse/core/ui/Icons'

import type { WebSessionModel } from '../sessionModel/index.ts'

const useStyles = makeStyles()(theme => ({
  cards: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 16,
  },
  card: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    minWidth: 240,
    padding: '16px 18px',
    borderRadius: 12,
    border: `1px solid ${theme.palette.divider}`,
    background: 'transparent',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'box-shadow 150ms ease, transform 150ms ease',
    '&:hover': {
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.06)',
      transform: 'translateY(-1px)',
    },
  },
  icon: {
    color: theme.palette.text.secondary,
    flexShrink: 0,
  },
  label: {
    fontSize: 14,
    fontWeight: 600,
    color: theme.palette.text.primary,
  },
  desc: {
    fontSize: 12,
    color: theme.palette.text.secondary,
  },
}))

const SettingsCards = observer(function SettingsCards({
  session,
}: {
  session: WebSessionModel
}) {
  const { classes } = useStyles()

  return (
    <div className={classes.cards}>
      <button
        className={classes.card}
        type="button"
        onClick={() => {
          session.showWidget(
            session.widgets.get('pluginStoreWidget') ??
              session.addWidget('PluginStoreWidget', 'pluginStoreWidget'),
          )
        }}
      >
        <ExtensionIcon className={classes.icon} />
        <div>
          <Typography className={classes.label}>Plugin store</Typography>
          <Typography className={classes.desc}>
            Browse and install plugins
          </Typography>
        </div>
      </button>
      <button
        className={classes.card}
        type="button"
        onClick={() => {
          session.queueDialog((onClose: () => void) => [
            AssemblyManager,
            {
              onClose,
              session,
            },
          ])
        }}
      >
        <DNA className={classes.icon} />
        <div>
          <Typography className={classes.label}>Assembly manager</Typography>
          <Typography className={classes.desc}>
            Add, edit, or remove assemblies
          </Typography>
        </div>
      </button>
    </div>
  )
})

export default SettingsCards
