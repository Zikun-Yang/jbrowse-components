import { barPlotDrawer } from './barPlot.ts'
import { precomputedBoxPlotDrawer, rawBoxPlotDrawer } from './boxPlot.ts'
import { histogramPlotDrawer } from './histogramPlot.ts'
import { rawViolinPlotDrawer } from './violinPlot.ts'

import type { DrawerFunction, FeatureChartDrawerMeta } from './types.ts'

/** Registered drawer: serializable catalog entry plus its draw function. */
export interface FeatureChartDrawerEntry {
  meta: FeatureChartDrawerMeta
  draw: DrawerFunction
}

export interface ResolvedFeatureChartDrawer {
  drawer: DrawerFunction
  meta: FeatureChartDrawerMeta
}

export interface FeatureChartDrawerError {
  error: string
  available: string[]
}

export type FeatureChartDrawerResolution =
  | ResolvedFeatureChartDrawer
  | FeatureChartDrawerError

const registry = new Map<string, FeatureChartDrawerEntry>()

const DEFAULT_DRAWER_SIZE = { width: 120, height: 180 }

function compareNames(a: string, b: string) {
  return a < b ? -1 : a > b ? 1 : 0
}

/**
 * Fill in the parts of the catalog entry a caller did not provide, so drawers
 * registered through the legacy two-argument form still show up in the catalog.
 */
function normalizeMeta(
  name: string,
  meta?: Partial<FeatureChartDrawerMeta>,
): FeatureChartDrawerMeta {
  return {
    name,
    displayName: meta?.displayName ?? name,
    description: meta?.description ?? `Custom FeatureChart drawer "${name}"`,
    dataShape: meta?.dataShape ?? 'any',
    ...(meta?.defaultSize ? { defaultSize: meta.defaultSize } : {}),
    ...(meta?.optionsSchema === undefined
      ? {}
      : { optionsSchema: meta.optionsSchema }),
  }
}

/**
 * Register a drawer under `name`. The third argument is optional so existing
 * callers (and third-party packages written before the catalog existed) keep
 * working; unregistered metadata is filled in with safe defaults.
 */
export function registerFeatureChartDrawer(
  name: string,
  drawer: DrawerFunction,
  meta?: Partial<FeatureChartDrawerMeta>,
) {
  registry.set(name, { meta: normalizeMeta(name, meta), draw: drawer })
}

export function getFeatureChartDrawer(
  name: string,
): DrawerFunction | undefined {
  return registry.get(name)?.draw
}

export function getFeatureChartDrawerMeta(
  name: string,
): FeatureChartDrawerMeta | undefined {
  return registry.get(name)?.meta
}

/** Catalog of registered drawers, sorted by `name` for stable UI/agent output. */
export function listFeatureChartDrawers(): FeatureChartDrawerMeta[] {
  return [...registry.values()]
    .map(entry => entry.meta)
    .sort((a, b) => compareNames(a.name, b.name))
}

export function listFeatureChartDrawerNames(): string[] {
  return listFeatureChartDrawers().map(meta => meta.name)
}

/**
 * Look up a drawer without throwing. Renderers use this so an unknown or empty
 * `drawer` name degrades to a readable placeholder instead of failing the
 * whole track (a worker-level throw marks every chart in the view as broken).
 */
export function resolveFeatureChartDrawer(
  name: string | undefined | null,
): FeatureChartDrawerResolution {
  const available = listFeatureChartDrawerNames()
  const entry = name ? registry.get(name) : undefined
  if (!entry) {
    return {
      error: name
        ? `Unknown FeatureChart drawer "${name}"`
        : 'No FeatureChart drawer configured',
      available,
    }
  }
  return { drawer: entry.draw, meta: entry.meta }
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
