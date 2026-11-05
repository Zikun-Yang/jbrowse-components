import { resolveTrackInfo } from '@jbrowse/product-core'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { ResolvedTrackInfo } from '@jbrowse/product-core'
import type { AbstractSessionModel } from '@jbrowse/core/util'

declare global {
  interface Window {
    /**
     * Host bridge for `@jbrowse/agent-sdk` (`jbrowse.trackInfo().info` /
     * `.infoText`).
     *
     * The SDK is plain JS injected into the page and cannot import the
     * markdown/jexl pipeline, so the app resolves the info once here and the
     * SDK reads the result. Same function the "About this track" dialog uses,
     * which is the point: the agent must never be able to describe a track
     * differently from the UI.
     *
     * `undefined` until a session exists, and absent in builds that do not
     * install it (the SDK then omits `info`/`infoText` instead of inventing
     * empty strings).
     */
    __jbrowseTrackInfo?: (
      config: AnyConfigurationModel | Record<string, unknown>,
    ) => ResolvedTrackInfo
  }
}

/**
 * Publish the track-info resolver for the agent SDK. Called where the app
 * publishes `window.JBrowseSession` / `window.JBrowseRootModel`.
 */
export function installTrackInfoBridge({
  session,
  pluginManager,
}: {
  session: AbstractSessionModel
  pluginManager: PluginManager
}) {
  window.__jbrowseTrackInfo = config =>
    resolveTrackInfo(config, session, pluginManager)
}
