import { useMemo } from 'react'

import { readConfObject } from '@jbrowse/core/configuration'
import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import SanitizedHTML from '@jbrowse/core/ui/SanitizedHTML'
import { getSession } from '@jbrowse/core/util'
import { getTrackName } from '@jbrowse/core/util/tracks'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Box, Card, Checkbox, IconButton, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import { CloseIcon, MoreHorizIcon } from '@jbrowse/core/ui/Icons'

import ClearableSearchField from './ClearableSearchField.tsx'
import { isUnsupported } from './util.ts'
import { sortConfs } from '../sortUtils.ts'
import { matches } from '../util.ts'

import type { HierarchicalTrackSelectorModel } from '../model.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

const useStyles = makeStyles()(theme => ({
  root: {
    padding: theme.spacing(2),
    overflow: 'auto',
    height: '100%',
    boxSizing: 'border-box',
  },
  search: {
    marginBottom: theme.spacing(2),
  },
  sectionTitle: {
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(1),
  },
  cardRow: {
    display: 'flex',
    gap: theme.spacing(1),
    overflowX: 'auto',
    paddingBottom: theme.spacing(1),
  },
  card: {
    minWidth: 220,
    maxWidth: 260,
    flexShrink: 0,
    padding: theme.spacing(1),
    display: 'flex',
    flexDirection: 'column',
    border: `1px solid ${theme.palette.divider}`,
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
  },
  trackName: {
    cursor: 'pointer',
    flexGrow: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    '&:hover': {
      textDecoration: 'underline',
    },
  },
  description: {
    color: theme.palette.text.secondary,
    overflow: 'hidden',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    marginTop: theme.spacing(0.5),
  },
  compactCheckbox: {
    padding: 0,
  },
  menuButton: {
    padding: 0,
  },
}))

interface TrackEntry {
  conf: AnyConfigurationModel
  id: string
  trackId: string
  name: string
  description: string
}

function openAboutDialog(
  conf: AnyConfigurationModel,
  model: HierarchicalTrackSelectorModel,
) {
  const session = getSession(model)
  const aboutItem = session
    .getTrackListMenuItems?.(conf)
    .find(item => 'label' in item && item.label === 'About track')
  if (aboutItem && 'onClick' in aboutItem) {
    aboutItem.onClick()
  }
}

const TrackCard = observer(function TrackCard({
  model,
  entry,
}: {
  model: HierarchicalTrackSelectorModel
  entry: TrackEntry
}) {
  const { classes } = useStyles()
  const { conf, id, trackId, name, description } = entry
  const session = getSession(model)
  const checked = model.shownTrackIds.has(trackId)

  return (
    <Card className={classes.card} variant="outlined">
      <Box className={classes.cardHeader}>
        <Checkbox
          className={classes.compactCheckbox}
          checked={checked}
          disabled={isUnsupported(name)}
          onChange={() => {
            model.view.toggleTrack(trackId)
          }}
          slotProps={{
            input: {
              // @ts-expect-error
              'data-testid': `htsTrackEntry-${id}`,
            },
          }}
        />
        <Typography
          className={classes.trackName}
          data-testid={`htsTrackLabel-${id}`}
          title={name}
          onClick={() => {
            openAboutDialog(conf, model)
          }}
        >
          <SanitizedHTML html={name} />
        </Typography>
        <CascadingMenuButton
          className={classes.menuButton}
          data-testid={`htsTrackEntryMenu-${id}`}
          menuItems={() => session.getTrackListMenuItems?.(conf) || []}
        >
          <MoreHorizIcon />
        </CascadingMenuButton>
      </Box>
      {description ? (
        <Typography variant="body2" className={classes.description}>
          {description}
        </Typography>
      ) : null}
    </Card>
  )
})

const ActiveTrackCard = observer(function ActiveTrackCard({
  model,
  entry,
}: {
  model: HierarchicalTrackSelectorModel
  entry: TrackEntry
}) {
  const { classes } = useStyles()
  const { id, trackId, name } = entry
  return (
    <Card className={classes.card} variant="outlined">
      <Box className={classes.cardHeader}>
        <Typography
          className={classes.trackName}
          data-testid={`htsActiveTrack-${id}`}
          title={name}
        >
          <SanitizedHTML html={name} />
        </Typography>
        <IconButton
          size="small"
          aria-label={`Remove ${name}`}
          data-testid={`htsActiveTrackRemove-${id}`}
          onClick={() => {
            model.view.toggleTrack(trackId)
          }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>
    </Card>
  )
})

function CardSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  const { classes } = useStyles()
  return (
    <Box>
      <Typography variant="subtitle1" className={classes.sectionTitle}>
        {title}
      </Typography>
      <Box className={classes.cardRow}>{children}</Box>
    </Box>
  )
}

const CardTrackSelector = observer(function CardTrackSelector({
  model,
}: {
  model: HierarchicalTrackSelectorModel
}) {
  const { classes } = useStyles()
  const session = getSession(model)
  const { filterText, activeSortTrackNames, activeSortCategories } = model

  // Group tracks into sections, one per category name. A track with a
  // multi-level category (e.g. ["Human", "RNA-seq"]) appears in each
  // category section of its path.
  const sections = useMemo(() => {
    const multipleGroups = model.allTracks.length > 1
    const sectionMap = new Map<string, TrackEntry[]>()
    for (const { group, tracks } of model.allTracks) {
      const confs = sortConfs(
        tracks.filter(conf => matches(filterText, conf, session)),
        activeSortTrackNames,
        activeSortCategories,
      )
      for (const conf of confs) {
        const isSessionTrack = conf.trackId.endsWith('sessionTrack')
        const categories = [
          ...(isSessionTrack ? ['Session tracks'] : []),
          ...((readConfObject(conf, 'category') || []) as string[]),
        ]
        const entry: TrackEntry = {
          conf,
          id: `${group},${conf.trackId}`,
          trackId: conf.trackId,
          name: getTrackName(conf, session),
          description: readConfObject(conf, 'description') || '',
        }
        if (categories.length) {
          for (const category of categories) {
            const title = multipleGroups ? `${group} / ${category}` : category
            const list = sectionMap.get(title)
            if (list) {
              if (!list.some(e => e.id === entry.id)) {
                list.push(entry)
              }
            } else {
              sectionMap.set(title, [entry])
            }
          }
        } else {
          const title = multipleGroups
            ? `${group} / Uncategorized`
            : 'Uncategorized'
          const list = sectionMap.get(title)
          if (list) {
            list.push(entry)
          } else {
            sectionMap.set(title, [entry])
          }
        }
      }
    }
    return [...sectionMap.entries()]
  }, [
    model.allTracks,
    filterText,
    activeSortTrackNames,
    activeSortCategories,
    session,
  ])

  const { shownTrackIds, allTrackConfigurationTrackIdSet } = model
  const activeTracks = useMemo(() => {
    return [...shownTrackIds].flatMap(trackId => {
      const conf = allTrackConfigurationTrackIdSet.get(trackId)
      return conf
        ? [
            {
              conf,
              id: trackId,
              trackId,
              name: getTrackName(conf, session),
              description: '',
            },
          ]
        : []
    })
  }, [shownTrackIds, allTrackConfigurationTrackIdSet, session])

  return (
    <Box className={classes.root} data-testid="hierarchical_track_selector">
      <ClearableSearchField
        className={classes.search}
        value={filterText}
        onChange={val => {
          model.setFilterText(val)
        }}
        label="Search tracks"
      />
      {activeTracks.length ? (
        <CardSection title="Active tracks">
          {activeTracks.map(entry => (
            <ActiveTrackCard
              key={`active-${entry.id}`}
              model={model}
              entry={entry}
            />
          ))}
        </CardSection>
      ) : null}
      {sections.map(([title, entries]) => (
        <CardSection key={title} title={title}>
          {entries.map(entry => (
            <TrackCard
              key={`${title}-${entry.id}`}
              model={model}
              entry={entry}
            />
          ))}
        </CardSection>
      ))}
    </Box>
  )
})

export default CardTrackSelector
