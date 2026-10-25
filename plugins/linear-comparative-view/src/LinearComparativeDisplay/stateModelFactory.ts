import {
  ConfigurationReference,
  readConfObject,
} from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import {
  dedupe,
  getContainingView,
  getSession,
  makeAbortableReaction,
} from '@jbrowse/core/util'
import { stopStopToken } from '@jbrowse/core/util/stopToken'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { getParent, getSnapshot, types } from '@jbrowse/mobx-state-tree'

import type { LinearComparativeViewModel } from '../LinearComparativeView/model.ts'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'
import type { Instance } from '@jbrowse/mobx-state-tree'

// above this bpPerPx, individual cigar ops are far below one pixel, so
// features are fetched without their CIGAR strings: the ribbons are drawn
// from feature start/end anyway, and hover/follow position mapping falls
// back to linear interpolation — visually identical at these zoom levels,
// but avoids transferring the (often enormous) CIGAR of every record over
// RPC on each navigation. zooming back in across the threshold re-fetches
// with CIGAR included
const CIGAR_DETAIL_MAX_BP_PER_PX = 1000

/**
 * #stateModel LinearComparativeDisplay
 * extends
 * - [BaseDisplay](../basedisplay)
 */
function stateModelFactory(configSchema: AnyConfigurationSchemaType) {
  return types
    .compose(
      'LinearComparativeDisplay',
      BaseDisplay,
      types.model({
        /**
         * #property
         */
        type: types.literal('LinearComparativeDisplay'),
        /**
         * #property
         */
        configuration: ConfigurationReference(configSchema),
      }),
    )
    .volatile(() => ({
      /**
       * #volatile
       */
      renderInProgress: undefined as string | undefined,
      /**
       * #volatile
       */
      features: undefined as Feature[] | undefined,
      /**
       * #volatile
       * features fetched over views[level + 1]'s blocks with the adapter's
       * orientation auto-flipped, so refName is in views[level + 1] coords and
       * mate in views[level] coords. only populated while followSynteny is on;
       * used exclusively to build the reverse follow index, never rendered
       */
      mateFeatures: undefined as Feature[] | undefined,
      /**
       * #volatile
       */
      message: undefined as string | undefined,
      /**
       * #volatile
       */
      loadingStatus: undefined as string | undefined,
    }))
    .views(self => {
      const { renderProps: superRenderProps } = self
      return {
        /**
         * #getter
         */
        get level() {
          return getParent<{ height: number; level: number }>(self, 4).level
        },
        /**
         * #getter
         */
        get height() {
          return getParent<{ height: number; level: number }>(self, 4).height
        },
        /**
         * #method
         */
        renderProps() {
          return {
            ...superRenderProps(),
          }
        },
      }
    })
    .actions(self => {
      let stopToken: undefined | string

      return {
        /**
         * #action
         * controlled by a reaction
         */
        setLoading(newStopToken: string) {
          self.message = undefined
          self.error = undefined
          stopToken = newStopToken
        },

        /**
         * #action
         * controlled by a reaction
         */
        setMessage(messageText: string) {
          self.message = messageText
          self.error = undefined
          stopToken = undefined
        },

        /**
         * #action
         * controlled by a reaction
         */
        setLoadingStatus(messageText: string) {
          self.loadingStatus = messageText
        },

        /**
         * #action
         * controlled by a reaction
         */
        setRendered(args?: { features: Feature[] }) {
          if (!args) {
            return
          }
          const { features } = args
          self.message = undefined
          self.error = undefined
          stopToken = undefined
          if (
            featureSetChanged(self.features || [], features) ||
            !self.features
          ) {
            self.features = features
          }
        },

        /**
         * #action
         * controlled by a reaction
         */
        setMateRendered(args?: { features: Feature[] }) {
          if (!args) {
            return
          }
          const { features } = args
          if (
            featureSetChanged(self.mateFeatures || [], features) ||
            !self.mateFeatures
          ) {
            self.mateFeatures = features
          }
        },

        /**
         * #action
         * controlled by a reaction
         */
        setError(error: unknown) {
          console.error(error)
          if (stopToken !== undefined) {
            stopStopToken(stopToken)
          }
          // the rendering failed for some reason
          self.message = undefined
          self.error = error
          stopToken = undefined
        },
      }
    })
    .actions(self => ({
      afterAttach() {
        makeAbortableReaction(
          // @ts-expect-error
          self,
          renderBlockData,
          renderBlockEffect,
          {
            name: `${self.type} ${self.id} rendering`,
            delay: 1000,
            fireImmediately: true,
          },
          self.setLoading,
          self.setRendered,
          self.setError,
        )
        // reverse-coverage fetch for followSynteny: loads the same track's
        // alignments over views[level + 1]'s blocks (adapter flips
        // orientation), so that following navigation from the bottom view
        // works even when the top view's own render has no coverage of the
        // new position. gated on followSynteny to cost nothing when off.
        makeAbortableReaction(
          // @ts-expect-error
          self,
          mateRenderBlockData,
          mateRenderBlockEffect,
          {
            name: `${self.type} ${self.id} mate feature fetch`,
            delay: 1000,
            fireImmediately: true,
          },
          () => {},
          self.setMateRendered,
          (e: unknown) => {
            console.error(e)
          },
        )
      },
    }))
}

function featureSetChanged(existing: Feature[], next: Feature[]) {
  const existingIds = new Set(existing.map(f => f.id()))
  const nextIds = new Set(next.map(f => f.id()))
  return (
    next.some(f => !existingIds.has(f.id())) ||
    existing.some(f => !nextIds.has(f.id()))
  )
}
function renderBlockData(self: LinearComparativeDisplay) {
  const { rpcManager } = getSession(self)
  const display = self

  // Alternative to readConfObject(config) is below used because
  // renderProps is something under our control.  Compare to
  // serverSideRenderedBlock
  readConfObject(self.configuration)

  const { level, adapterConfig } = self
  const parent = getContainingView(self) as LinearComparativeViewModel
  const sessionId = getRpcSessionId(self)
  getSnapshot(parent)
  return parent.initialized
    ? {
        rpcManager,
        renderProps: {
          ...(display.renderProps() as Record<string, unknown>),
          model: display,
          level,
          view: parent,
          adapterConfig,
          sessionId,
          timeout: 1000000,
          self,
        },
      }
    : undefined
}

async function renderBlockEffect(props: ReturnType<typeof renderBlockData>) {
  if (!props) {
    return
  }

  const { rpcManager, renderProps } = props
  const { model, sessionId, adapterConfig, level } = renderProps
  const view = renderProps.view.views[level]!
  return {
    features: dedupe(
      (await rpcManager.call(sessionId, 'CoreGetFeatures', {
        regions: view.staticBlocks.contentBlocks,
        sessionId,
        adapterConfig,
        opts: { includeCigar: view.bpPerPx <= CIGAR_DETAIL_MAX_BP_PER_PX },
        statusCallback: (arg: string) => {
          model.setLoadingStatus(arg)
        },
      })) as Feature[],
      f => f.id(),
    ),
  }
}

function mateRenderBlockData(self: LinearComparativeDisplay) {
  const { rpcManager } = getSession(self)
  readConfObject(self.configuration)
  const { level, adapterConfig } = self
  const parent = getContainingView(self) as LinearComparativeViewModel
  const sessionId = getRpcSessionId(self)
  getSnapshot(parent)
  return parent.initialized && parent.followSynteny
    ? {
        rpcManager,
        renderProps: {
          model: self,
          level,
          view: parent,
          adapterConfig,
          sessionId,
          timeout: 1000000,
        },
      }
    : undefined
}

async function mateRenderBlockEffect(
  props: ReturnType<typeof mateRenderBlockData>,
) {
  if (!props) {
    return
  }
  const { rpcManager, renderProps } = props
  const { sessionId, adapterConfig, level } = renderProps
  const view = renderProps.view.views[level + 1]!
  return {
    features: dedupe(
      (await rpcManager.call(sessionId, 'CoreGetFeatures', {
        regions: view.staticBlocks.contentBlocks,
        sessionId,
        adapterConfig,
        opts: { includeCigar: view.bpPerPx <= CIGAR_DETAIL_MAX_BP_PER_PX },
      })) as Feature[],
      f => f.id(),
    ),
  }
}

export default stateModelFactory
export type LinearComparativeDisplayModel = ReturnType<typeof stateModelFactory>
export type LinearComparativeDisplay = Instance<LinearComparativeDisplayModel>
