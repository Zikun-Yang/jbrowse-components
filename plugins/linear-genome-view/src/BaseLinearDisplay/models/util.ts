import { getContainingView, getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { isAlive } from '@jbrowse/mobx-state-tree'

import type { LinearGenomeViewModel } from '../../LinearGenomeView/index.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { FeatureDensityStats } from '@jbrowse/core/data_adapters/BaseAdapter'

export function getDisplayStr(totalBytes: number) {
  if (Math.floor(totalBytes / 1000000) > 0) {
    return `${Number.parseFloat((totalBytes / 1000000).toPrecision(3))} Mb`
  } else if (Math.floor(totalBytes / 1000) > 0) {
    return `${Number.parseFloat((totalBytes / 1000).toPrecision(3))} Kb`
  } else {
    return `${Math.floor(totalBytes)} bytes`
  }
}

// reads the global auto-size-track-height session settings via loose typing,
// since plugins cannot depend on @jbrowse/product-core where the session
// mixin lives. sessions without the mixin (e.g. embedded products) get
// enabled=false, preserving the legacy fixed-height behavior
export function getAutoHeightSettings(session: unknown) {
  const s = session as {
    autoSizeTrackHeight?: boolean
    minAutoTrackHeight?: number
    maxAutoTrackHeight?: number
  }
  return {
    enabled: s.autoSizeTrackHeight === true,
    min: s.minAutoTrackHeight ?? 20,
    max: s.maxAutoTrackHeight ?? 1000,
  }
}

// max content height across rendered block layouts, or undefined if no block
// has reported a layout yet (still rendering, or a renderer without layout
// support like wiggle/arc/hic).
//
// computed from the max rectangle bottom rather than layout.getTotalHeight():
// the layout is shared per-refName across the whole track for row stability
// while panning, so getTotalHeight() is the chromosome-wide max including
// previously visited dense regions. the serialized rectangles are filtered
// to the block's region, so their max bottom reflects what is actually drawn
export function getBlocksContentHeight(
  blocks: Iterable<{
    layout?: {
      getTotalHeight?: () => number
      getRectangles?: () => Map<string, number[]>
    } | undefined
  }>,
) {
  let sawLayout = false
  let content = 0
  for (const b of blocks) {
    const { layout } = b
    if (!layout) {
      continue
    }
    const rectangles = layout.getRectangles?.()
    if (rectangles) {
      sawLayout = true
      for (const rect of rectangles.values()) {
        const bottom = rect[3] ?? 0
        if (bottom > content) {
          content = bottom
        }
      }
    } else {
      const h = layout.getTotalHeight?.()
      if (h !== undefined) {
        sawLayout = true
        if (h > content) {
          content = h
        }
      }
    }
  }
  return sawLayout ? content : undefined
}

// stabilize clipid under test for snapshot
export function getId(id: string, index: string | number) {
  const notJest = typeof jest === 'undefined'
  return ['clip', notJest ? id : 'jest', index, notJest ? Math.random() : '']
    .filter(f => !!f)
    .join('-')
}

export async function getFeatureDensityStatsPre(self: {
  adapterConfig?: AnyConfigurationModel
  setStatusMessage: (arg: string) => void
  effectiveRpcDriverName?: string
}) {
  const view = getContainingView(self) as LinearGenomeViewModel
  const regions = view.staticBlocks.contentBlocks

  const { rpcManager } = getSession(self)
  const { adapterConfig, effectiveRpcDriverName } = self
  if (!adapterConfig) {
    // A track extending the base track might not have an adapter config
    // e.g. Apollo tracks don't use adapters
    return {}
  } else {
    const sessionId = getRpcSessionId(self)

    return rpcManager.call(sessionId, 'CoreGetFeatureDensityStats', {
      sessionId,
      regions,
      adapterConfig,
      rpcDriverName: effectiveRpcDriverName,
      statusCallback: (message: string) => {
        if (isAlive(self)) {
          self.setStatusMessage(message)
        }
      },
    }) as Promise<FeatureDensityStats>
  }
}
