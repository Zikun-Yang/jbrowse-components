import { barPlotDrawer } from './barPlot.ts'
import { precomputedBoxPlotDrawer, rawBoxPlotDrawer } from './boxPlot.ts'
import { histogramPlotDrawer } from './histogramPlot.ts'
import { rawViolinPlotDrawer } from './violinPlot.ts'

import type {
  DrawerFunction,
  FeatureChartDrawerDataShape,
  FeatureChartDrawerMeta,
} from './types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'

/**
 * Extension point plugins use to contribute drawers.
 *
 * The extension point receives the currently registered drawers and returns the
 * full list, so the idiomatic plugin body is
 * `drawers => [...drawers, myDrawer]`.
 */
export const FEATURE_CHART_DRAWER_EXTENSION_POINT = 'Core-featureChartDrawer'

/** Registered drawer: serializable catalog entry plus its draw function. */
export interface FeatureChartDrawerEntry {
  meta: FeatureChartDrawerMeta
  draw: DrawerFunction
}

/**
 * What a plugin contributes through `Core-featureChartDrawer`. Only `name` and
 * `draw` are required; the catalog fields are filled with safe defaults so a
 * no-build, untyped plugin cannot crash the catalog.
 */
export interface FeatureChartDrawerContribution {
  name: string
  draw: DrawerFunction
  displayName?: string
  description?: string
  dataShape?: FeatureChartDrawerDataShape
  defaultSize?: { width: number; height: number }
  optionsSchema?: unknown
}

export interface ResolvedFeatureChartDrawer {
  drawer: DrawerFunction
  meta: FeatureChartDrawerMeta
}

export interface FeatureChartDrawerError {
  /** Human-readable reason, shown as the placeholder/dialog title. */
  error: string
  /** The configured name, absent when nothing was configured. */
  drawerName?: string
  available: string[]
  /**
   * Set for `pluginName/drawerName` names: the plugin that is supposed to
   * provide the drawer. Used to say "the plugin is missing" instead of just
   * "unknown drawer".
   */
  missingPlugin?: string
  /**
   * Set when `missingPlugin` names a plugin that *is* loaded, i.e. the plugin
   * is present but does not provide this drawer (usually a typo).
   */
  pluginLoaded?: boolean
  /** Registered names that look like a typo of the requested one. */
  suggestions?: string[]
}

export type FeatureChartDrawerResolution =
  | ResolvedFeatureChartDrawer
  | FeatureChartDrawerError

interface FeatureChartDrawerCatalog {
  entries: Map<string, FeatureChartDrawerEntry>
  /** Sorted by name with a plain `<` comparison: identical in every runtime. */
  sorted: FeatureChartDrawerMeta[]
}

const DATA_SHAPES: FeatureChartDrawerDataShape[] = [
  'tissues',
  'matrix',
  'series',
  'any',
]

const DEFAULT_DRAWER_SIZE = { width: 120, height: 180 }

/**
 * Module-level registry. This is the **legacy** path: it only ever sees
 * registrations made by code that shares this module instance (the built-ins
 * and in-repo callers). Plugins loaded as separate ES modules get their own
 * copy of this module, so a registration there is invisible to the host — they
 * must use the `Core-featureChartDrawer` extension point instead, which is
 * merged per `PluginManager` below.
 */
const registry = new Map<string, FeatureChartDrawerEntry>()

/**
 * Bumped whenever the module-level registry changes. Cached per-`PluginManager`
 * catalogs compare against it, so a legacy registration or `initBuiltInDrawers`
 * invalidates them lazily without tracking individual `PluginManager`s.
 */
let catalogEpoch = 1

const pluginManagerCatalogs = new WeakMap<
  PluginManager,
  { epoch: number; catalog: FeatureChartDrawerCatalog }
>()

let legacyCatalog:
  | { epoch: number; catalog: FeatureChartDrawerCatalog }
  | undefined

const warnedMessages = new Set<string>()

function isDevelopment() {
  // `process` is not available in every runtime (webpack replaces
  // `process.env.NODE_ENV` statically at build time), so guard the access
  return typeof process !== 'undefined' && process.env.NODE_ENV !== 'production'
}

/** Log once per message, and only in development builds. */
function warnOnce(message: string) {
  if (!isDevelopment() || warnedMessages.has(message)) {
    return
  }
  warnedMessages.add(message)
  console.warn(`[feature-chart] ${message}`)
}

function compareNames(a: string, b: string) {
  return a < b ? -1 : a > b ? 1 : 0
}

function toDataShape(value: unknown): FeatureChartDrawerDataShape {
  return typeof value === 'string' && (DATA_SHAPES as string[]).includes(value)
    ? (value as FeatureChartDrawerDataShape)
    : 'any'
}

/**
 * Fill in the parts of the catalog entry a caller did not provide, so drawers
 * registered through the legacy two-argument form (or by an untyped plugin)
 * still show up in the catalog with usable metadata.
 */
function normalizeMeta(
  name: string,
  meta?: Partial<FeatureChartDrawerMeta>,
): FeatureChartDrawerMeta {
  return {
    name,
    displayName: meta?.displayName || name,
    description: meta?.description || `Custom FeatureChart drawer "${name}"`,
    dataShape: toDataShape(meta?.dataShape),
    ...(meta?.defaultSize ? { defaultSize: meta.defaultSize } : {}),
    ...(meta?.optionsSchema === undefined
      ? {}
      : { optionsSchema: meta.optionsSchema }),
  }
}

function sortCatalog(
  entries: Map<string, FeatureChartDrawerEntry>,
): FeatureChartDrawerMeta[] {
  return [...entries.values()]
    .map(entry => entry.meta)
    .sort((a, b) => compareNames(a.name, b.name))
}

function createCatalog(entries: Map<string, FeatureChartDrawerEntry>) {
  return { entries, sorted: sortCatalog(entries) }
}

/**
 * Register a drawer on the legacy module-level registry. Only code that shares
 * this module instance sees it — in practice the built-ins, tests, and in-repo
 * callers. **Plugins must use `Core-featureChartDrawer` instead**: a plugin's
 * bundled copy of this module is a different module instance, so a registration
 * here would silently do nothing.
 */
export function registerFeatureChartDrawer(
  name: string,
  drawer: DrawerFunction,
  meta?: Partial<FeatureChartDrawerMeta>,
) {
  registry.set(name, { meta: normalizeMeta(name, meta), draw: drawer })
  catalogEpoch++
}

/** Built-in drawers, in registration order (used as the extension point base). */
function builtInContributions(): FeatureChartDrawerContribution[] {
  return [...registry.values()].map(entry => ({
    ...entry.meta,
    draw: entry.draw,
  }))
}

function mergeContribution(
  entries: Map<string, FeatureChartDrawerEntry>,
  contribution: unknown,
) {
  if (!contribution || typeof contribution !== 'object') {
    warnOnce('a Core-featureChartDrawer callback returned a non-object entry')
    return
  }
  const { name, draw } = contribution as Partial<FeatureChartDrawerContribution>
  if (typeof name !== 'string' || name.length === 0) {
    warnOnce('a Core-featureChartDrawer entry has no `name`')
    return
  }
  if (typeof draw !== 'function') {
    warnOnce(`drawer "${name}" was contributed without a \`draw\` function`)
    return
  }
  if (!name.includes('/') && !entries.has(name)) {
    warnOnce(
      `drawer "${name}" is not namespaced; plugin drawers should be named "pluginName/drawerName" to avoid collisions with built-ins`,
    )
  }

  const existing = entries.get(name)
  if (existing && existing.draw !== draw) {
    // Later registration wins (documented behaviour), but never silently: a
    // plugin replacing a built-in changes what an existing config renders.
    warnOnce(
      `drawer "${name}" was overridden by a plugin (previous implementation replaced)`,
    )
  }
  entries.set(name, {
    meta: normalizeMeta(name, contribution as Partial<FeatureChartDrawerMeta>),
    draw,
  })
}

/**
 * Merge the module-level registry with whatever the loaded plugins contributed
 * through `Core-featureChartDrawer`.
 *
 * The extension point is evaluated with the built-ins as its argument, so a
 * plugin can append to them. Entries returned by plugins are applied in order
 * and win over an equally named earlier entry; a plugin that returns a list
 * without the built-ins cannot accidentally erase them.
 */
function buildPluginManagerCatalog(
  pluginManager: PluginManager,
): FeatureChartDrawerCatalog {
  const entries = new Map(registry)
  const base = builtInContributions()

  let contributed: unknown
  try {
    contributed = pluginManager.evaluateExtensionPoint(
      FEATURE_CHART_DRAWER_EXTENSION_POINT,
      base,
    )
  } catch (error) {
    // evaluateExtensionPoint already isolates callback errors; this only guards
    // against a broken plugin manager, which must not take the track down.
    console.error(error)
    contributed = base
  }

  const list = Array.isArray(contributed) ? contributed : base
  for (const contribution of list) {
    mergeContribution(entries, contribution)
  }
  return createCatalog(entries)
}

function getLegacyCatalog(): FeatureChartDrawerCatalog {
  if (legacyCatalog?.epoch !== catalogEpoch) {
    legacyCatalog = {
      epoch: catalogEpoch,
      catalog: createCatalog(new Map(registry)),
    }
  }
  return legacyCatalog.catalog
}

/**
 * A real `PluginManager` is required to merge plugin contributions. Tests and
 * third-party callers occasionally pass a partial object (or `{}`); treat that
 * as "no plugin manager" instead of throwing in the middle of a render.
 */
function isPluginManagerLike(
  value: PluginManager | null | undefined,
): value is PluginManager {
  return typeof value?.evaluateExtensionPoint === 'function'
}

/**
 * The catalog for a `PluginManager`: built-ins plus plugin contributions.
 * Cached per `PluginManager` and invalidated when the module registry changes
 * (see `clearFeatureChartDrawerCache`).
 */
function getCatalog(
  pluginManager?: PluginManager | null,
): FeatureChartDrawerCatalog {
  if (!isPluginManagerLike(pluginManager)) {
    return getLegacyCatalog()
  }
  const cached = pluginManagerCatalogs.get(pluginManager)
  if (cached?.epoch === catalogEpoch) {
    return cached.catalog
  }
  const catalog = buildPluginManagerCatalog(pluginManager)
  pluginManagerCatalogs.set(pluginManager, { epoch: catalogEpoch, catalog })
  return catalog
}

/**
 * Drop cached catalogs.
 *
 * - `clearFeatureChartDrawerCache(pluginManager)`: rebuild that plugin manager's
 *   catalog on next read (tests, hot reload, a plugin added after a render).
 * - `clearFeatureChartDrawerCache()`: invalidate every `PluginManager` catalog.
 */
export function clearFeatureChartDrawerCache(
  pluginManager?: PluginManager | null,
) {
  if (isPluginManagerLike(pluginManager)) {
    pluginManagerCatalogs.delete(pluginManager)
  } else {
    catalogEpoch++
    legacyCatalog = undefined
  }
}

export function getFeatureChartDrawer(
  name: string | undefined | null,
  pluginManager?: PluginManager | null,
): DrawerFunction | undefined {
  if (!name) {
    return undefined
  }
  return getCatalog(pluginManager).entries.get(name)?.draw
}

export function getFeatureChartDrawerMeta(
  name: string | undefined | null,
  pluginManager?: PluginManager | null,
): FeatureChartDrawerMeta | undefined {
  if (!name) {
    return undefined
  }
  return getCatalog(pluginManager).entries.get(name)?.meta
}

/**
 * Catalog of registered drawers, sorted by `name` for stable UI/agent output.
 * Pass the `PluginManager` to include plugin-contributed drawers.
 */
export function listFeatureChartDrawers(
  pluginManager?: PluginManager | null,
): FeatureChartDrawerMeta[] {
  return [...getCatalog(pluginManager).sorted]
}

export function listFeatureChartDrawerNames(
  pluginManager?: PluginManager | null,
): string[] {
  return getCatalog(pluginManager).sorted.map(meta => meta.name)
}

function bareName(name: string) {
  const index = name.lastIndexOf('/')
  return (index === -1 ? name : name.slice(index + 1)).toLowerCase()
}

/** Registered names that look like what the user actually meant. */
function findSimilarDrawerNames(name: string, available: string[]): string[] {
  const bare = bareName(name)
  if (bare.length < 3) {
    return []
  }
  const lowerName = name.toLowerCase()
  return available
    .filter(candidate => {
      const lowerCandidate = candidate.toLowerCase()
      if (lowerCandidate === lowerName) {
        return true
      }
      const candidateBare = bareName(candidate)
      return (
        candidateBare === bare ||
        candidateBare.includes(bare) ||
        bare.includes(candidateBare)
      )
    })
    .slice(0, 3)
}

function pluginProvidesDrawer(
  pluginManager: PluginManager | null | undefined,
  prefix: string,
) {
  if (!pluginManager || !Array.isArray(pluginManager.plugins)) {
    return undefined
  }
  const wanted = prefix.toLowerCase()
  // Plugin names are author-controlled, so compare case-insensitively; the
  // namespace convention is `pluginName/drawerName`.
  return pluginManager.plugins.some(
    plugin => plugin.name.toLowerCase() === wanted,
  )
}

/**
 * Look up a drawer without throwing. Renderers use this so an unknown or empty
 * `drawer` name degrades to a readable placeholder instead of failing the
 * whole track (a worker-level throw marks every chart in the view as broken).
 *
 * Pass the `PluginManager` to resolve plugin-contributed drawers.
 */
export function resolveFeatureChartDrawer(
  name: string | undefined | null,
  pluginManager?: PluginManager | null,
): FeatureChartDrawerResolution {
  const catalog = getCatalog(pluginManager)
  const available = catalog.sorted.map(meta => meta.name)
  const entry = name ? catalog.entries.get(name) : undefined
  if (entry) {
    return { drawer: entry.draw, meta: entry.meta }
  }
  if (!name) {
    return {
      error: 'No FeatureChart drawer configured',
      available,
    }
  }

  const slash = name.lastIndexOf('/')
  const pluginPrefix = slash > 0 ? name.slice(0, slash) : undefined
  const suggestions = findSimilarDrawerNames(name, available)
  const pluginLoaded =
    pluginPrefix === undefined
      ? undefined
      : pluginProvidesDrawer(pluginManager, pluginPrefix)

  return {
    error: `Unknown FeatureChart drawer "${name}"`,
    drawerName: name,
    available,
    ...(pluginPrefix === undefined ? {} : { missingPlugin: pluginPrefix }),
    ...(pluginLoaded === undefined ? {} : { pluginLoaded }),
    ...(suggestions.length === 0 ? {} : { suggestions }),
  }
}

export function isFeatureChartDrawerResolutionError(
  resolution: FeatureChartDrawerResolution,
): resolution is FeatureChartDrawerError {
  return 'error' in resolution
}

export function initBuiltInDrawers() {
  registerFeatureChartDrawer('precomputedBoxPlot', precomputedBoxPlotDrawer, {
    displayName: 'Precomputed box plot',
    description:
      'One box per category from precomputed five-number statistics (data.boxes).',
    dataShape: 'matrix',
    defaultSize: DEFAULT_DRAWER_SIZE,
  })
  registerFeatureChartDrawer('rawBoxPlot', rawBoxPlotDrawer, {
    displayName: 'Box plot (raw values)',
    description:
      'One box per group from raw observations, computing quartiles in the browser (data.tissues).',
    dataShape: 'tissues',
    defaultSize: DEFAULT_DRAWER_SIZE,
  })
  registerFeatureChartDrawer('rawViolinPlot', rawViolinPlotDrawer, {
    displayName: 'Violin plot (raw values)',
    description: 'KDE violin per group from raw observations (data.tissues).',
    dataShape: 'tissues',
    defaultSize: DEFAULT_DRAWER_SIZE,
  })
  registerFeatureChartDrawer('barPlot', barPlotDrawer, {
    displayName: 'Bar plot',
    description:
      'One bar per category from a single numeric value (data.bars).',
    dataShape: 'matrix',
    defaultSize: DEFAULT_DRAWER_SIZE,
  })
  registerFeatureChartDrawer('histogram', histogramPlotDrawer, {
    displayName: 'Histogram',
    description:
      'Frequency histogram of one numeric series, with automatic binning (data.values).',
    dataShape: 'series',
    defaultSize: DEFAULT_DRAWER_SIZE,
  })
}
