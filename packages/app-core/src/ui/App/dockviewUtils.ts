import { createElementId } from '@jbrowse/core/util/types/mst'

import { isSessionWithDockviewLayout } from '../../DockviewLayout/index.ts'

import type { DockviewSessionType } from './types.ts'
import type { AbstractViewModel } from '@jbrowse/core/util'
import type {
  AddPanelPositionOptions,
  Direction,
  DockviewApi,
  DockviewGroupPanel,
  DockviewPanelMoveParams,
  IDockviewPanel,
  Position,
} from 'dockview-react'

export function getViewsForPanel(
  panelId: string,
  session: DockviewSessionType | undefined,
): AbstractViewModel[] {
  if (!session || !isSessionWithDockviewLayout(session)) {
    return []
  }
  const viewIds = session.getViewIdsForPanel(panelId)
  return [...viewIds]
    .map(id => session.views.find(v => v.id === id))
    .filter((v): v is AbstractViewModel => v !== undefined)
}

export function createPanelConfig(
  panelId: string,
  session: DockviewSessionType,
  title = 'Main',
  viewId?: string,
) {
  return {
    id: panelId,
    component: 'jbrowseView' as const,
    title,
    params: { panelId, session, viewId },
  }
}

export function addPanelForView(
  api: DockviewApi,
  session: DockviewSessionType,
  viewId: string,
  options?: {
    referenceGroup?: DockviewGroupPanel
    direction?: 'right' | 'below'
  },
) {
  const panelId = `panel-${createElementId()}`
  const group = api.addGroup({
    ...(options?.referenceGroup
      ? {
          referenceGroup: options.referenceGroup,
          direction: options.direction ?? 'right',
        }
      : { direction: 'within' }),
    hideHeader: true,
  })
  const panel = api.addPanel({
    ...createPanelConfig(panelId, session, 'View', viewId),
    position: { referenceGroup: group },
  })
  return { panelId, panel, group }
}

export function cleanLayoutForStorage(
  layout: ReturnType<DockviewApi['toJSON']>,
) {
  return {
    ...layout,
    panels: Object.fromEntries(
      Object.entries(layout.panels).map(([id, panel]) => [
        id,
        { ...panel, params: { viewId: panel.params?.viewId } },
      ]),
    ),
  }
}

export function updatePanelParams(
  api: DockviewApi,
  session: DockviewSessionType,
) {
  for (const panel of api.panels) {
    panel.update({
      params: {
        panelId: panel.id,
        session,
        viewId: panel.params?.viewId,
      },
    })
  }
}

function directionToPosition(
  direction: Direction | undefined,
): Position | undefined {
  switch (direction) {
    case 'left':
      return 'left'
    case 'right':
      return 'right'
    case 'above':
      return 'top'
    case 'below':
      return 'bottom'
    case 'within':
      return 'center'
    default:
      return undefined
  }
}

export function rearrangePanelsWithDirection(
  api: DockviewApi,
  getPosition: (
    index: number,
    panels: IDockviewPanel[],
  ) => AddPanelPositionOptions | undefined,
) {
  const panels = [...api.panels]
  for (let i = 0; i < panels.length; i++) {
    const positionOptions = getPosition(i, panels)
    if (!positionOptions) {
      continue
    }

    let moveParams: DockviewPanelMoveParams | undefined
    if ('referencePanel' in positionOptions) {
      const refPanel =
        typeof positionOptions.referencePanel === 'string'
          ? api.getPanel(positionOptions.referencePanel)
          : positionOptions.referencePanel
      if (refPanel) {
        moveParams = {
          group: refPanel.group,
          position: directionToPosition(positionOptions.direction),
        }
      }
    } else if ('referenceGroup' in positionOptions) {
      const refGroup =
        typeof positionOptions.referenceGroup === 'string'
          ? api.groups.find(g => g.id === positionOptions.referenceGroup)
          : positionOptions.referenceGroup
      if (refGroup) {
        moveParams = {
          group: refGroup,
          position: directionToPosition(positionOptions.direction),
        }
      }
    }

    if (moveParams) {
      panels[i]!.api.moveTo(moveParams)
    }
  }
}

export function tilePanelsHorizontally(api: DockviewApi) {
  rearrangePanelsWithDirection(api, (idx, states) =>
    idx === 0 ? undefined : { referencePanel: states[0]!.id, direction: 'right' },
  )
}

export function tilePanelsVertically(api: DockviewApi) {
  rearrangePanelsWithDirection(api, (idx, states) =>
    idx === 0 ? undefined : { referencePanel: states[0]!.id, direction: 'below' },
  )
}

export function tilePanelsGrid(api: DockviewApi) {
  const panels = api.panels
  if (panels.length <= 1) {
    return
  }
  const cols = Math.ceil(Math.sqrt(panels.length))
  rearrangePanelsWithDirection(api, (idx, states) => {
    if (idx === 0) {
      return undefined
    }
    const col = idx % cols
    const row = Math.floor(idx / cols)
    if (col === 0) {
      const refIdx = (row - 1) * cols
      return { referencePanel: states[refIdx]!.id, direction: 'below' }
    }
    return { referencePanel: states[idx - 1]!.id, direction: 'right' }
  })
}

