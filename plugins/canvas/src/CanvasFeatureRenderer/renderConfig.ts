import { readConfObject } from '@jbrowse/core/configuration'

import type { ColorSchemeConfig, ScoreStats } from './colorScheme.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'

/**
 * IMPORTANT: Config Reading Performance Optimization
 *
 * Reading config values via readConfObject is expensive because:
 * 1. It may involve JEXL expression evaluation
 * 2. It traverses the config tree
 * 3. It can trigger MobX reactions
 *
 * In rendering code, we process thousands of features in tight loops.
 * Calling readConfObject per-feature creates significant overhead.
 *
 * SOLUTION: Read all non-feature-dependent config values ONCE at the start
 * of the rendering pipeline and pass them through as a context object.
 *
 * For feature-dependent configs (callbacks), we use CachedConfig which stores
 * both the cached value and whether it needs per-feature evaluation.
 */

/**
 * A cached config value that may need per-feature evaluation.
 * - If isCallback is false, use `value` directly (fast path)
 * - If isCallback is true, call readCachedConfig() to evaluate per-feature
 *
 * A callback has no `value` on purpose: the value would be per-feature, so
 * there is no single value to cache and no default to duplicate here. Plain
 * slots are resolved once through readConfObject, which already falls back to
 * the default declared on the config schema.
 */
export type CachedConfig<T> =
  | { isCallback: true }
  | { isCallback: false; value: T }

/**
 * Read a potentially cached config value.
 * Uses cached value if not a callback, otherwise evaluates per-feature.
 */
export function readCachedConfig<T>(
  cached: CachedConfig<T>,
  config: AnyConfigurationModel,
  key: string | string[],
  feature: Feature,
): T {
  return cached.isCallback
    ? (readConfObject(config, key, { feature }) as T)
    : cached.value
}

/**
 * Read a slot once. Callback slots are only flagged here, never evaluated:
 * the renderer evaluates them per feature via readCachedConfig. All other
 * slots go through readConfObject, so the value (and its fallback) comes from
 * the config schema - never from a hardcoded copy in this file.
 */
function createCachedConfig<T>(
  config: AnyConfigurationModel,
  key: string | string[],
): CachedConfig<T> {
  const configSlot = Array.isArray(key)
    ? key.reduce((acc: any, k) => acc?.[k], config)
    : config[key]
  return configSlot?.isCallback
    ? { isCallback: true }
    : { isCallback: false, value: readConfObject(config, key) as T }
}

export interface RenderConfigContext {
  // Reference to the raw config for callback evaluation
  config: AnyConfigurationModel

  displayMode: string
  showLabels: boolean
  showDescriptions: boolean
  labelPlacement: string
  subfeatureLabels: string

  transcriptTypes: string[]
  containerTypes: string[]

  color1: CachedConfig<string>
  color2: CachedConfig<string>
  color3: CachedConfig<string>
  outline: CachedConfig<string>

  /**
   * Native color scheme config. `default` keeps using color1/color2/color3.
   */
  colorScheme: ColorSchemeConfig
  /**
   * Score distribution for the current render block, filled in by doAll when
   * the score color scheme is active. Undefined elsewhere.
   */
  scoreStats?: ScoreStats
  /**
   * Color CDS features by reading frame (was previously a renderProps flag
   * with no producer).
   */
  colorByCDS: boolean

  featureHeight: CachedConfig<number>
  fontHeight: CachedConfig<number>
  nameColor: CachedConfig<string>
  descriptionColor: CachedConfig<string>

  labelAllowed: boolean
  geneGlyphMode: string
  displayDirectionalChevrons: boolean

  /**
   * Multiplier for feature height based on displayMode.
   * normal=1, compact=0.5
   */
  heightMultiplier: number
}

function getHeightMultiplier(displayMode: string) {
  if (displayMode === 'compact') {
    return 0.5
  }
  return 1
}

export function createRenderConfigContext(
  config: AnyConfigurationModel,
): RenderConfigContext {
  const displayMode = readConfObject(config, 'displayMode') as string

  return {
    config,
    displayMode,
    showLabels: readConfObject(config, 'showLabels') as boolean,
    showDescriptions: readConfObject(config, 'showDescriptions') as boolean,
    labelPlacement: readConfObject(config, 'labelPlacement') as string,
    subfeatureLabels: readConfObject(config, 'subfeatureLabels') as string,
    transcriptTypes: readConfObject(config, 'transcriptTypes') as string[],
    containerTypes: readConfObject(config, 'containerTypes') as string[],
    geneGlyphMode: readConfObject(config, 'geneGlyphMode') as string,
    displayDirectionalChevrons: readConfObject(
      config,
      'displayDirectionalChevrons',
    ) as boolean,

    color1: createCachedConfig<string>(config, 'color1'),
    color2: createCachedConfig<string>(config, 'color2'),
    color3: createCachedConfig<string>(config, 'color3'),
    outline: createCachedConfig<string>(config, 'outline'),

    colorScheme: {
      kind: readConfObject(config, 'colorScheme') as ColorSchemeConfig['kind'],
      colorField: readConfObject(config, 'colorField') as string,
      scoreField: readConfObject(config, 'scoreField') as string,
      scorePalette: readConfObject(config, 'scorePalette') as string,
      scoreScale: readConfObject(config, 'scoreScale') as 'linear' | 'quantile',
      scoreAutoRange: readConfObject(config, 'scoreAutoRange') as boolean,
      scoreMin: readConfObject(config, 'scoreMin') as number,
      scoreMax: readConfObject(config, 'scoreMax') as number,
      typePalette: readConfObject(config, 'typePalette') as string,
    },
    colorByCDS: readConfObject(config, 'colorByCDS') as boolean,

    featureHeight: createCachedConfig<number>(config, 'height'),
    fontHeight: createCachedConfig<number>(config, ['labels', 'fontSize']),
    nameColor: createCachedConfig<string>(config, ['labels', 'nameColor']),
    descriptionColor: createCachedConfig<string>(config, [
      'labels',
      'descriptionColor',
    ]),

    labelAllowed: displayMode !== 'collapse',
    heightMultiplier: getHeightMultiplier(displayMode),
  }
}
