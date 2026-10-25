import {
  buildQuantileContext,
  getCategoricalColor,
  getContinuousHex,
  valueToQuantile,
} from '@jbrowse/core/util'

import type { Feature, QuantileContext } from '@jbrowse/core/util'

/**
 * Native feature coloring schemes. These are configured directly on the
 * renderer (track config `renderer.colorScheme`) and do not require a jexl
 * expression or a runtime plugin.
 *
 * - `default` uses the existing color1/color2/color3 slots (jexl callbacks
 *   still work exactly as before)
 * - `featureField` reads a color straight from a feature attribute, e.g. the
 *   BED `itemRgb` column normalized to `color` by @jbrowse/plugin-bed
 * - `score` maps a numeric attribute through a continuous palette
 * - `strand` uses color1/color3/color2 for +, -, and unstranded features
 * - `type` maps the feature `type` attribute through a categorical palette
 */
export const COLOR_SCHEMES = [
  'default',
  'featureField',
  'score',
  'strand',
  'type',
] as const

export type ColorSchemeName = (typeof COLOR_SCHEMES)[number]

export interface ColorSchemeConfig {
  kind: ColorSchemeName
  colorField: string
  scoreField: string
  scorePalette: string
  scoreScale: 'linear' | 'quantile'
  scoreAutoRange: boolean
  scoreMin: number
  scoreMax: number
  typePalette: string
}

export interface ScoreStats {
  min: number
  max: number
  quantiles: QuantileContext
}

const NAMED_COLOR_RE = /^[a-z]+$/i
const FUNCTIONAL_COLOR_RE = /^(rgb|rgba|hsl|hsla)\(/i

/**
 * Parse a color value stored on a feature. Handles the BED `itemRgb`/`reserved`
 * `"r,g,b"` triplet, hex colors, `rgb()/hsl()` functions and CSS named colors.
 * Returns undefined for anything else so that the caller can fall back to the
 * configured color1.
 */
export function parseFeatureColorValue(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined
  }
  const str = String(value).trim()
  if (str.startsWith('#') || FUNCTIONAL_COLOR_RE.test(str)) {
    return str
  }
  const parts = str.split(',')
  if (parts.length === 3) {
    const nums = parts.map(p => Number.parseInt(p.trim(), 10))
    if (nums.every(n => Number.isFinite(n))) {
      const [r, g, b] = nums.map(n => Math.max(0, Math.min(255, n)))
      return `rgb(${r}, ${g}, ${b})`
    }
    return undefined
  }
  return NAMED_COLOR_RE.test(str) ? str : undefined
}

function toFiniteNumber(value: unknown): number | undefined {
  const num =
    typeof value === 'number' ? value : Number.parseFloat(String(value))
  return Number.isFinite(num) ? num : undefined
}

/**
 * Collect the min/max and quantile distribution of a numeric feature
 * attribute for the features in one render block. This makes `score` coloring
 * auto-ranging (and quantile scaling) possible without any config changes.
 */
export function computeScoreStats(
  features: Iterable<Feature>,
  scoreField: string,
): ScoreStats | undefined {
  const values: number[] = []
  for (const feature of features) {
    const v = toFiniteNumber(feature.get(scoreField))
    if (v !== undefined) {
      values.push(v)
    }
  }
  if (!values.length) {
    return undefined
  }
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  for (const v of values) {
    if (v < min) {
      min = v
    }
    if (v > max) {
      max = v
    }
  }
  return { min, max, quantiles: buildQuantileContext(values) }
}

// FNV-1a, used to give each feature type a stable palette slot regardless of
// which types happen to be visible in the current block
function hashString(str: string) {
  let hash = 0x81_1c_9d_c5
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i)
    hash = Math.imul(hash, 0x01_00_01_93)
  }
  return Math.abs(hash)
}

/**
 * Resolve the color for a feature under the active color scheme. Returns
 * undefined when the scheme cannot produce a color for this feature (missing
 * attribute, unparseable value, ...) so the caller falls back to color1.
 *
 * `strand` is handled by the caller because it maps onto the existing
 * color1/color2/color3 slots.
 */
export function resolveFeatureColor({
  feature,
  scheme,
  stats,
}: {
  feature: Feature
  scheme: ColorSchemeConfig
  stats?: ScoreStats
}): string | undefined {
  switch (scheme.kind) {
    case 'default': {
      return undefined
    }
    case 'featureField': {
      return parseFeatureColorValue(feature.get(scheme.colorField))
    }
    case 'score': {
      const v = toFiniteNumber(feature.get(scheme.scoreField))
      if (v === undefined) {
        return undefined
      }
      let t: number
      const range =
        scheme.scoreAutoRange && stats
          ? { min: stats.min, max: stats.max }
          : { min: scheme.scoreMin, max: scheme.scoreMax }
      if (scheme.scoreScale === 'quantile' && stats) {
        t = valueToQuantile(stats.quantiles, v)
      } else {
        t =
          range.max > range.min ? (v - range.min) / (range.max - range.min) : 0
        t = Math.max(0, Math.min(1, t))
      }
      return getContinuousHex(t, scheme.scorePalette)
    }
    case 'strand': {
      // handled by getBoxColor using color1/color2/color3
      return undefined
    }
    case 'type': {
      const type = feature.get('type')
      return typeof type === 'string' && type
        ? getCategoricalColor(hashString(type), scheme.typePalette)
        : undefined
    }
    default: {
      return undefined
    }
  }
}

/**
 * Backwards compatible implementation of the old `jexl:colorFeature(feature)`
 * helper that used to live in the app-level `plugins/bedfeaturecoloring.js`
 * runtime plugin. It is registered by CanvasPlugin so that saved configs keep
 * working, but new configs should use `colorScheme` instead.
 *
 * Unlike the old helper this reads both the standard BED `itemRgb` column and
 * the autosql `reserved` alias, and normalizes scores on the 0-1000 BED scale
 * (the old alpha = score/100 scaling clipped almost everything to opaque).
 */
export function legacyColorFeature(feature: Feature | undefined): string {
  if (!feature) {
    return 'gray'
  }
  const fromField =
    parseFeatureColorValue(feature.get('color')) ??
    parseFeatureColorValue(feature.get('itemRgb')) ??
    parseFeatureColorValue(feature.get('reserved'))
  if (fromField) {
    return fromField
  }
  const score = toFiniteNumber(feature.get('score'))
  return score === undefined
    ? 'gray'
    : getContinuousHex(Math.max(0, Math.min(1, score / 1000)), 'viridis')
}
