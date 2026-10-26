import { getCategoricalColorForKey, getContinuousHex } from '@jbrowse/core/util'

import type { LegendItem } from '../BaseLinearDisplay/components/FloatingLegend.tsx'
import type { FeatureColorLegendData } from '@jbrowse/core/util'

/** Swatches drawn for a continuous scale. Five reads as a smooth ramp. */
const SCORE_STEPS = 5

/** Rows kept for a categorical scale: enough to read the palette, small
 * enough that the overlay does not cover the track. */
const MAX_TYPE_ROWS = 6

/**
 * Renderer config values the legend depends on. Resolved by the display
 * (track override first, then track config) and passed in as plain values so
 * this module stays a pure function and easy to test.
 */
export interface ColorLegendConfig {
  scheme: string
  scorePalette: string
  scoreScale: string
  scoreAutoRange: boolean
  scoreMin: number
  scoreMax: number
  typePalette: string
}

/**
 * Compact number label: 0.25, 7.5, 250, 1000. Scores are not rounded to a
 * fixed number of decimals because their magnitude varies per dataset.
 */
export function formatScoreValue(value: number) {
  const digits = Math.abs(value) >= 100 ? 0 : Math.abs(value) >= 10 ? 1 : 2
  return `${Number(value.toFixed(digits))}`
}

/**
 * Continuous scale legend: one row per step of the palette with the score it
 * stands for. When the range is automatic the labels come from the scores the
 * renderer actually saw, so the legend never claims a range the colors are not
 * using.
 *
 * Quantile scaling ranks each block's scores, so there is no fixed value per
 * color; the rows are labelled by rank instead of inventing one.
 */
function scoreLegend(config: ColorLegendConfig, data: FeatureColorLegendData) {
  if (config.scoreScale === 'quantile') {
    return range(SCORE_STEPS).map(i => {
      const t = i / (SCORE_STEPS - 1)
      return {
        color: getContinuousHex(t, config.scorePalette),
        label: `${Math.round(t * 100)}%`,
      }
    })
  }

  const min = config.scoreAutoRange ? data.min : config.scoreMin
  const max = config.scoreAutoRange ? data.max : config.scoreMax

  // nothing rendered yet, or no numeric scores in view
  if (min === undefined || max === undefined) {
    return []
  }

  return range(SCORE_STEPS).map(i => {
    const t = i / (SCORE_STEPS - 1)
    return {
      color: getContinuousHex(t, config.scorePalette),
      label: formatScoreValue(min + (max - min) * t),
    }
  })
}

/**
 * Categorical legend: the most frequent feature types in view, most common
 * first. Types beyond the cap are summarized in one row instead of growing the
 * overlay without bound.
 */
function typeLegend(
  config: ColorLegendConfig,
  data: FeatureColorLegendData,
): LegendItem[] {
  const counts = data.typeCounts ?? []
  const items: LegendItem[] = counts.slice(0, MAX_TYPE_ROWS).map(([type]) => ({
    color: getCategoricalColorForKey(type, config.typePalette),
    label: type,
  }))
  const hidden = counts.length - items.length
  return hidden > 0 ? [...items, { label: `+${hidden} more` }] : items
}

function range(n: number) {
  return [...new Array(n).keys()]
}

/**
 * Legend for the active feature color scheme, built from the data the renderer
 * reported for the visible blocks. Schemes whose colors are not data-derived
 * (`default`, `featureField`) and `strand` (chevrons already show it) return no
 * items, so the "Show legend" menu entry stays hidden for them.
 */
export function buildColorLegend(
  config: ColorLegendConfig,
  data: FeatureColorLegendData = {},
): LegendItem[] {
  switch (config.scheme) {
    case 'score': {
      return scoreLegend(config, data)
    }
    case 'type': {
      return typeLegend(config, data)
    }
    default: {
      return []
    }
  }
}

/** Whether the given color scheme has a legend worth showing */
export function hasColorLegend(scheme: string) {
  return scheme === 'score' || scheme === 'type'
}
