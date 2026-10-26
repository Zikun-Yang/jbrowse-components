import { readConfObject } from '@jbrowse/core/configuration'

import { DEFAULT_COLOR_SCHEME } from './FeatureChartDrawer/colorSchemes.ts'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

export type FeatureChartAlign = 'left' | 'right' | 'center'

/**
 * Everything the renderers need from their own config. Both
 * `FeatureChartRenderer` and `FeatureChartPlotlyRenderer` resolve this from the
 * `config` render prop, so the display does not have to copy slots into the
 * render props, and adding a slot later (WP2/WP3) is a one-file change.
 */
export interface FeatureChartRenderSettings {
  drawer: string
  chartWidth: number
  chartHeight: number
  align: FeatureChartAlign
  maxChartsPerView: number
  minChartSpacingPx: number
  colorScheme: string
}

/** Mirrors the `defaultValue`s in `FeatureChartRenderer/configSchema.ts`. */
export const FEATURE_CHART_RENDER_DEFAULTS: FeatureChartRenderSettings = {
  drawer: 'precomputedBoxPlot',
  chartWidth: 120,
  chartHeight: 180,
  align: 'center',
  maxChartsPerView: 100,
  minChartSpacingPx: 4,
  colorScheme: DEFAULT_COLOR_SCHEME,
}

function toFiniteNumber(value: unknown, fallback: number): number {
  const num = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(num) ? num : fallback
}

function toAlign(value: unknown): FeatureChartAlign {
  return value === 'left' || value === 'right' || value === 'center'
    ? value
    : FEATURE_CHART_RENDER_DEFAULTS.align
}

function toDrawerName(value: unknown): string {
  return typeof value === 'string' && value.length > 0
    ? value
    : FEATURE_CHART_RENDER_DEFAULTS.drawer
}

function toColorScheme(value: unknown): string {
  // Unknown names are intentionally passed through: resolveColorScheme() falls
  // back to the default and warns once, so a typo in a config is visible.
  return typeof value === 'string' && value.length > 0
    ? value
    : FEATURE_CHART_RENDER_DEFAULTS.colorScheme
}

function readSlot(config: AnyConfigurationModel | undefined, slot: string) {
  return config ? readConfObject(config, slot) : undefined
}

/**
 * Read chart geometry and styling from a renderer config model. Accepts both an
 * instantiated config model and a plain serialized snapshot (what arrives in a
 * worker), and falls back to the schema defaults for anything missing.
 */
export function resolveFeatureChartRenderSettings(
  config?: AnyConfigurationModel | null,
): FeatureChartRenderSettings {
  return {
    drawer: toDrawerName(readSlot(config ?? undefined, 'drawer')),
    chartWidth: Math.max(
      1,
      toFiniteNumber(
        readSlot(config ?? undefined, 'chartWidth'),
        FEATURE_CHART_RENDER_DEFAULTS.chartWidth,
      ),
    ),
    chartHeight: Math.max(
      1,
      toFiniteNumber(
        readSlot(config ?? undefined, 'chartHeight'),
        FEATURE_CHART_RENDER_DEFAULTS.chartHeight,
      ),
    ),
    align: toAlign(readSlot(config ?? undefined, 'align')),
    maxChartsPerView: Math.max(
      1,
      toFiniteNumber(
        readSlot(config ?? undefined, 'maxChartsPerView'),
        FEATURE_CHART_RENDER_DEFAULTS.maxChartsPerView,
      ),
    ),
    minChartSpacingPx: Math.max(
      0,
      toFiniteNumber(
        readSlot(config ?? undefined, 'minChartSpacingPx'),
        FEATURE_CHART_RENDER_DEFAULTS.minChartSpacingPx,
      ),
    ),
    colorScheme: toColorScheme(readSlot(config ?? undefined, 'colorScheme')),
  }
}
