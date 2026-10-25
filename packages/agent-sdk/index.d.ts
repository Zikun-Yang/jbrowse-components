/**
 * @jbrowse/agent-sdk — AI-facing API reference.
 *
 * These types describe the `jbrowse` object available inside scripts executed
 * by jbrowse-agent (products/jbrowse-agent/run.mjs). The runtime code is
 * plain JS injected into the JBrowse page (src/index.js); this file is the
 * documentation of record for script authors and AI agents.
 */

declare namespace jbrowse {
  interface RegionInfo {
    assemblyName?: string
    refName: string
    start: number
    end: number
  }

  interface ViewInfo {
    id: string
    /** e.g. 'LinearGenomeView', 'LinearSyntenyView' */
    type: string
    displayName?: string
    assemblyNames: string[]
    /** current displayed regions (comparative views: all rows, flattened) */
    regions: RegionInfo[]
    /**
     * the actually-visible window, e.g. "chr1:10000-20000" — prefer this
     * over regions when you want "where am I looking"
     */
    visible?: string
    /** trackIds currently shown in this view */
    trackIds: string[]
  }

  interface TrackInfo {
    id: string
    name: string
    /** e.g. 'FeatureTrack', 'VariantTrack', 'QuantitativeTrack' */
    type: string
    /** e.g. 'BamAdapter', 'VcfTabixAdapter' */
    adapter?: string
    assemblyNames: string[]
    category: string[]
    /** shown in at least one view */
    open: boolean
  }

  interface AssemblyInfo {
    name: string
    displayName?: string
    aliases: string[]
  }

  interface TrackFilter {
    /** true = only tracks shown in a view; false = only hidden ones */
    open?: boolean
    /** case-insensitive substring matched against name and id */
    name?: string
    /** exact track type, e.g. 'VariantTrack' */
    type?: string
    /** exact assembly name */
    assembly?: string
  }

  interface StateDigest {
    viewCount: number
    activeView?: {
      id: string
      type: string
      /** e.g. "chr1:10001-20000 (hg38)" */
      region: string
    }
    openTracks: string[]
    warnings?: string[]
  }

  interface DisplayConfig {
    trackId: string
    displayType: string
    /** available set* actions on this display */
    setters: string[]
    /** current values behind those setters (where readable) */
    current: Record<string, unknown>
  }

  interface Agent {
    /** List all views in the session. */
    views(): ViewInfo[]

    /**
     * List configured tracks (open or hidden). Results are capped at
     * `opts.limit` (default 50); when capped, a warning is attached to the
     * digest — narrow with a filter instead of paging.
     */
    tracks(filter?: TrackFilter, opts?: { limit?: number }): TrackInfo[]

    /**
     * Find one track by exact id or fuzzy name.
     * Throws TRACK_NOT_FOUND / AMBIGUOUS_TRACK with a candidate list —
     * pick from `error.candidates` and retry.
     */
    track(idOrName: string): TrackInfo

    /** List assemblies configured in this session. */
    assemblies(): AssemblyInfo[]

    /**
     * Reference sequence names of an assembly. Note T2T-style assemblies
     * often use accessions rather than "chr1"-style names — check here
     * before goto() if you get "unknown reference sequence name".
     */
    refNames(assemblyName: string, opts?: { limit?: number }): Promise<string[]>

    /** Compact summary of current state. The runner attaches this automatically. */
    digest(): StateDigest

    /**
     * Navigate the first linear view to a location: either a coordinate
     * string ("chr1:10000-20000", routed to navToLocString) or a bare
     * gene/feature name ("NPEPPS", routed to the text index search — the
     * assembly must have a text search adapter configured).
     * Opens a new LinearGenomeView automatically if none exists.
     * Resolves after navigation + `opts.settleMs` (default 1000ms) so
     * subsequent screenshots catch settled rendering.
     */
    goto(
      loc: string,
      opts?: { assembly?: string; settleMs?: number },
    ): Promise<void>

    /**
     * View types that can be opened with openView(typeName), enumerated
     * from the plugin manager at runtime — depends on which plugins the
     * host app loaded. Internal/helper views (hidden from the GUI menu)
     * are not listed. `description` tells you what the view shows and
     * which tasks it is good for.
     */
    viewTypes(): {
      viewTypes: { name: string; displayName?: string; description?: string }[]
    }

    /**
     * Open a new view (default 'LinearGenomeView'), optionally navigating it
     * to `opts.loc`. Unknown type names throw UNKNOWN_VIEW_TYPE with the
     * registered types as candidates. Resolves to the new view's info after
     * rendering settles.
     */
    openView(
      typeName?: string,
      opts?: {
        loc?: string
        assembly?: string
        settleMs?: number
        /**
         * extra snapshot passed to addView — e.g. multi-way synteny:
         * { init: { views: [{ loc?, assembly, tracks? }],
         *           tracks?: string[][] (one entry per level, the gap
         *           between views[i] and views[i+1]) } }
         */
        init?: Record<string, unknown>
      },
    ): Promise<ViewInfo>

    /**
     * Show a track on a view (default: first view that can show tracks).
     * `trackRef` accepts an exact id or fuzzy name (same resolution as
     * track(), errors carry candidates).
     */
    showTrack(
      trackRef: string,
      opts?: { view?: string; settleMs?: number },
    ): Promise<TrackInfo>

    /** Hide a shown track. Throws TRACK_NOT_SHOWN if it isn't shown. */
    hideTrack(trackRef: string, opts?: { view?: string }): Promise<void>

    /**
     * Inspect what a shown track's display can be configured with.
     * Always call this before setConfig() on an unfamiliar track type.
     */
    displayConfig(trackRef: string, opts?: { view?: string }): DisplayConfig

    /**
     * Set a display state slot on a shown track by calling its setXxx
     * action — e.g. setConfig('synteny', 'colorBy', 'identity').
     * Throws NO_SETTER with the available setter list if unsupported.
     */
    setConfig(
      trackRef: string,
      slot: string,
      value: unknown,
      opts?: { view?: string },
    ): Promise<DisplayConfig>

    /**
     * Query features straight from a track's data adapter — the track does
     * NOT need to be shown and nothing is rendered. Use this for data
     * questions ("what genes are here", "compute a threshold over scores")
     * instead of reading the screen.
     * Returns serialized feature JSON (refName/start/end/name/score/...).
     */
    features(
      trackRef: string,
      region: string,
      opts?: { assembly?: string; limit?: number },
    ): Promise<Record<string, unknown>[]>

    /**
     * Export a view with JBrowse's own renderer (NOT a browser screenshot):
     * path ending .svg gives a vector file, .png rasterizes that SVG.
     * Format can be forced with opts.format. Waits for loading to settle
     * first (opts.noWait to skip).
     */
    exportView(
      path: string,
      opts?: { view?: string; format?: 'svg' | 'png'; noWait?: boolean },
    ): Promise<string>

    /**
     * Export the full session state (views, open tracks, display configs)
     * as JSON, restorable via the UI's session import.
     * With path: saves to disk. Without: returns the snapshot object.
     */
    exportSession(path?: string): Promise<Record<string, unknown> | { saved: string }>

    /**
     * Save a screenshot to the out dir (PNG).
     * Default captures the whole workspace area (all views together, without
     * the app header/sidebar). Pass opts.view for a single view,
     * opts.selector for an arbitrary element, or opts.fullPage for the
     * entire page. Content clipped by internal scroll containers (tall
     * tracks, stacked view rows) is automatically included: the runner
     * temporarily expands those containers and grows the viewport so
     * everything is genuinely on screen before capturing (pass noExpand
     * to disable). Waits for loading to settle first (see waitForIdle;
     * pass noWait to skip, timeoutMs/quietMs to tune).
     * Resolves to the saved absolute path.
     */
    screenshot(
      path: string,
      opts?: {
        view?: string
        selector?: string
        fullPage?: boolean
        noWait?: boolean
        noExpand?: boolean
        timeoutMs?: number
        quietMs?: number
      },
    ): Promise<string>

    /** Wait — useful after interactions that trigger async rendering. */
    sleep(ms: number): Promise<void>

    /**
     * Wait until the workspace is idle. Signals: no VISIBLE progress bars
     * or "Loading..." text (hidden decoys are ignored), and no display
     * block that is unfilled / render-pending / busy (covers status
     * phases like "Computing feature layout" that show no Loading text).
     * Loaded, empty, and FAILED renders all count as idle — only
     * in-flight work blocks. screenshot() and exportView() run this
     * automatically before capturing (pass opts.noWait to skip there).
     */
    waitForIdle(opts?: {
      /** give up after this long; default 30000 */
      timeoutMs?: number
      /** require this long with zero loading signals; default 500 */
      quietMs?: number
      /** poll interval; default 200 */
      pollMs?: number
    }): Promise<{
      idle: boolean
      waitedMs: number
      /** sample loading messages still present (only when idle=false) */
      stillLoading?: string[]
    }>

    /** List all methods, or show details for one. */
    help(method?: string): string

    /**
     * Verify every internal contract the SDK relies on (session handle,
     * DOM anchors, blockState shape, loading-decoy filtering, bridges).
     * Read-only — run it at the start of a session; a named failed check
     * beats silently degraded output. Some checks need an open view with
     * a shown track to be meaningful (they report "skip" otherwise).
     */
    selfTest(): {
      ok: boolean
      checks: { name: string; status: 'pass' | 'fail' | 'skip'; detail?: string }[]
    }
  }
}

/** The object injected into every script executed by jbrowse-agent. */
declare const jbrowse: jbrowse.Agent

export {}
