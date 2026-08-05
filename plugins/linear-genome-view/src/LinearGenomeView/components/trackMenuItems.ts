import { getContainingView, getSession } from '@jbrowse/core/util'

import {
  AddIcon,
  CloseIcon,
  KeyboardArrowDownIcon,
  KeyboardArrowUpIcon,
  KeyboardDoubleArrowDownIcon,
  KeyboardDoubleArrowUpIcon,
  LowPriorityIcon,
  MinimizeIcon,
  PushPinIcon,
} from '@jbrowse/core/ui/Icons'

import type { LinearGenomeViewModel } from '../model.ts'
import type { BaseTrackModel } from '@jbrowse/core/pluggableElementTypes/models'
import type { MenuItem } from '@jbrowse/core/ui'

export function getTrackMenuItems(track: BaseTrackModel): MenuItem[] {
  const view = getContainingView(track) as LinearGenomeViewModel
  const session = getSession(track)
  const trackConf = track.configuration
  const minimized = track.minimized
  const pinned = track.pinned
  const { isTopLevelView } = view

  const trackMenuItems = track.trackMenuItems()
  const saveTrackData = trackMenuItems.find(
    item => 'label' in item && item.label === 'Save track data',
  )
  const remainingTrackMenuItems = trackMenuItems.filter(
    item => !('label' in item) || item.label !== 'Save track data',
  )

  const sessionItems =
    session.getTrackActionMenuItems?.(
      trackConf,
      saveTrackData ? [saveTrackData] : [],
    ) || []

  return [
    {
      label: 'Track order',
      icon: LowPriorityIcon,
      type: 'subMenu' as const,
      priority: 1000,
      subMenu: [
        ...(!isTopLevelView
          ? []
          : [
              {
                label: pinned ? 'Unpin track' : 'Pin track',
                icon: PushPinIcon,
                onClick: () => {
                  track.setPinned(!pinned)
                },
              },
            ]),
        {
          label: minimized ? 'Restore track' : 'Minimize track',
          icon: minimized ? AddIcon : MinimizeIcon,
          onClick: () => {
            track.setMinimized(!minimized)
          },
        },
        ...(view.tracks.length > 2
          ? [
              {
                label: 'Move track to top',
                icon: KeyboardDoubleArrowUpIcon,
                onClick: () => {
                  view.moveTrackToTop(track.id)
                },
              },
            ]
          : []),
        ...(view.tracks.length > 1
          ? [
              {
                label: 'Move track up',
                icon: KeyboardArrowUpIcon,
                onClick: () => {
                  view.moveTrackUp(track.id)
                },
              },
              {
                label: 'Move track down',
                icon: KeyboardArrowDownIcon,
                onClick: () => {
                  view.moveTrackDown(track.id)
                },
              },
            ]
          : []),
        ...(view.tracks.length > 2
          ? [
              {
                label: 'Move track to bottom',
                icon: KeyboardDoubleArrowDownIcon,
                onClick: () => {
                  view.moveTrackToBottom(track.id)
                },
              },
            ]
          : []),
      ],
    },
    ...sessionItems,
    ...remainingTrackMenuItems,
    { type: 'divider' as const, priority: -1000 },
    {
      label: 'Close track',
      icon: CloseIcon,
      priority: -1001,
      onClick: () => {
        view.hideTrack(track.trackId)
      },
    },
  ].sort((a, b) => (b.priority || 0) - (a.priority || 0))
}
