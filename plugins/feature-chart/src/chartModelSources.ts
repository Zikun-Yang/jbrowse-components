import { getEnv } from '@jbrowse/core/util'

import {
  type ChartSpec,
  type ChartSpecError,
  SPEC_DRAWER_NAME,
  normalizeValidatedSpec,
  validateChartSpec,
} from './FeatureChartDrawer/chartSpec.ts'
import {
  type FeatureChartDrawerError,
  getFeatureChartDrawer,
  getFeatureChartDrawerMeta,
  isFeatureChartDrawerResolutionError,
  resolveFeatureChartDrawer,
} from './FeatureChartDrawer/drawerRegistry.ts'

import type { ChartModel } from './FeatureChartDrawer/chartModel.ts'
import type {
  ChartModelBuilder,
  DrawerFunction,
  FeatureChartDrawerMeta,
} from './FeatureChartDrawer/types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

/**
 * Where a chart's `ChartModel` comes from, resolved once per renderer.
 *
 * WP3 made `ChartModel` the single description of a chart. WP4 needs *both*
 * backends to obtain that model the same way:
 *
 * ```
 * renderer config ──▶ TrackChartSource ──▶ ChartModel (per feature) ──▶ backend
 *   drawer / spec          (once)                 (per data)          canvas | Plotly
 * ```
 *
 * Splitting the work in two is what keeps a 300-chart track cheap: structural
 * spec validation and the drawer lookup do not depend on the feature payload,
 * so they run once, and only `chartModelForData()` runs per chart.
 */
export interface TrackChartSource {
  /** The configured drawer name, echoed for error messages. */
  drawer: string
  /** Catalog entry of the resolved drawer, when it resolved. */
  meta?: FeatureChartDrawerMeta
  /** The drawer's paint function, when the name resolved. */
  draw?: DrawerFunction
  /**
   * Drawer-provided model builder (the five built-ins, and any plugin that
   * opts in). Absent for `spec` (the spec is the model) and for plugin drawers
   * that only know how to paint canvas.
   */
  buildModel?: ChartModelBuilder
  /** Set when `drawer: "spec"` and the spec is structurally valid. */
  spec?: ChartSpec
  /** Structural spec problems: the same verdict for every chart in the track. */
  specErrors?: ChartSpecError[]
  /** Set when the drawer name did not resolve (unknown name, missing plugin). */
  drawerError?: FeatureChartDrawerError
  /**
   * A drawer that paints from `data` and cannot produce a model. Canvas renders
   * it; the Plotly backend cannot, and says so instead of drawing something
   * different (see `ARCHITECTURE.md`).
   */
  canvasOnly: boolean
}

export interface ResolvedChartModel {
  model?: ChartModel
  /** Data-level problems (bad `spec.data.path`, wrong payload shape). */
  modelErrors?: ChartSpecError[]
}

/**
 * Resolve the drawer/spec half of the pipeline for one track render.
 *
 * Never throws: an unknown drawer or a broken spec is data the UI draws a
 * placeholder from, exactly as WP0/WP3 established.
 */
export function resolveTrackChartSource({
  drawer,
  spec,
  pluginManager,
}: {
  drawer: string
  spec: unknown
  pluginManager?: PluginManager | null
}): TrackChartSource {
  if (drawer === SPEC_DRAWER_NAME) {
    const specErrors = validateChartSpec(spec)
    const draw = getFeatureChartDrawer(SPEC_DRAWER_NAME, pluginManager)
    const meta = getFeatureChartDrawerMeta(SPEC_DRAWER_NAME, pluginManager)
    return {
      drawer,
      ...(draw === undefined ? {} : { draw }),
      ...(meta === undefined ? {} : { meta }),
      ...(specErrors.length > 0 ? { specErrors } : { spec: spec as ChartSpec }),
      canvasOnly: false,
    }
  }

  const resolution = resolveFeatureChartDrawer(drawer, pluginManager)
  if (isFeatureChartDrawerResolutionError(resolution)) {
    return { drawer, drawerError: resolution, canvasOnly: false }
  }
  return {
    drawer,
    meta: resolution.meta,
    draw: resolution.drawer,
    ...(resolution.buildModel ? { buildModel: resolution.buildModel } : {}),
    // No model builder = a canvas-only drawer (a plugin that paints itself).
    canvasOnly: resolution.buildModel === undefined,
  }
}

/**
 * The per-chart half: turn one feature's payload into the model the backends
 * draw. `source.specErrors` is the track-wide verdict and wins over anything
 * computed here.
 */
export function chartModelForData(
  source: TrackChartSource,
  data: unknown,
): ResolvedChartModel {
  if (source.spec) {
    const normalization = normalizeValidatedSpec(source.spec, data)
    return normalization.model === undefined
      ? { modelErrors: normalization.errors }
      : { model: normalization.model }
  }
  if (source.buildModel) {
    return { model: source.buildModel({ data }) }
  }
  return {}
}

/**
 * The `PluginManager` that owns a display, or `undefined` when the node is not
 * attached to a state tree (component tests, storybook). Catalog lookups then
 * fall back to the module registry instead of throwing inside a render.
 */
export function pluginManagerFor(
  node: IAnyStateTreeNode,
): PluginManager | undefined {
  try {
    return getEnv(node).pluginManager
  } catch {
    return undefined
  }
}
