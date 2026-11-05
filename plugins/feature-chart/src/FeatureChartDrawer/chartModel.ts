import type { SummaryStats } from './statistics.ts'

/**
 * The normalized chart model: what every painter actually draws.
 *
 * Three layers meet here (see `SPEC.md`):
 *
 * ```
 * feature payload ──▶ ChartModel ──▶ painter ──▶ canvas
 *        ▲                  ▲
 *    spec / legacy adapter ─┘
 * ```
 *
 * The config surface (`spec`) and the legacy drawer payloads are both inputs to
 * *this* shape, and there is exactly one painter per `kind`, so a legacy drawer
 * and its equivalent spec cannot render differently. `specEquivalence.test.ts`
 * asserts that by construction.
 */

export type ChartKind = 'box' | 'violin' | 'bar' | 'histogram'

/** The four data shapes of the v1 vocabulary (kebab-case, one spelling only). */
export type ChartDataForm =
  | 'summary-stats'
  | 'grouped-values'
  | 'category-values'
  | 'values'

/**
 * One category's data. The `form` field mirrors the spec's `data.form`, so a
 * painter can narrow on it instead of trusting the config twice.
 *
 * `color` is a **legacy passthrough**: the pre-WP3 drawers honoured a per-entry
 * `color` in `data.boxes` / `data.bars`, and dropping it would change what an
 * existing config renders. The `spec` surface deliberately has no per-item
 * color (the palette covers it), so spec-normalized models never carry one.
 */
export type ChartDatum =
  | { form: 'summary-stats'; stats: SummaryStats; color?: string }
  | { form: 'grouped-values'; values: number[] }
  | { form: 'category-values'; value: number; color?: string }
  | { form: 'values'; values: number[] }

export interface ChartSeries {
  /** Series name, `'values'` in v1 (there is exactly one series). */
  name: string
  /**
   * One entry per category, in `ChartModel.categories` order. For a flat
   * `values` series (`histogram`) there is exactly one entry and no categories.
   */
  data: ChartDatum[]
}

export interface ChartStyle {
  /** Overrides the renderer `colorScheme` slot when set. */
  colorScheme?: string
  /** Histogram bin count; ignored by the other kinds. */
  bins?: number
}

export interface ChartAxes {
  /** Rotated label on the left edge. Omitted = draw exactly what WP2 drew. */
  yLabel?: string
}

export interface ChartModel {
  kind: ChartKind
  /** Category names, in draw order. Empty for `values` (histogram). */
  categories: string[]
  /**
   * Always exactly one series in v1. The array exists so multi-series can be
   * added later (SPEC.md §9.4) without changing consumers.
   */
  series: ChartSeries[]
  style: ChartStyle
  axes: ChartAxes
}

export const DEFAULT_SERIES_NAME = 'values'

/** The datum form this model carries, or `undefined` for an empty model. */
export function chartModelForm(model: ChartModel): ChartDataForm | undefined {
  return model.series[0]?.data[0]?.form
}

/**
 * Numbers in a category, whichever shape the datum uses. Painters that only
 * need observations (box, violin) go through this.
 */
export function datumValues(datum: ChartDatum): number[] {
  switch (datum.form) {
    case 'grouped-values':
    case 'values':
      return datum.values
    case 'summary-stats':
      return []
    case 'category-values':
      return [datum.value]
  }
}

function serializeDatum(datum: ChartDatum): unknown {
  switch (datum.form) {
    case 'summary-stats':
      return {
        form: datum.form,
        stats: {
          min: datum.stats.min,
          q1: datum.stats.q1,
          median: datum.stats.median,
          q3: datum.stats.q3,
          max: datum.stats.max,
        },
        ...(datum.color === undefined ? {} : { color: datum.color }),
      }
    case 'category-values':
      return {
        form: datum.form,
        value: datum.value,
        ...(datum.color === undefined ? {} : { color: datum.color }),
      }
    case 'grouped-values':
    case 'values':
      return { form: datum.form, values: datum.values }
  }
}

/**
 * Stable serialization: identical models produce an identical string, in every
 * runtime. Explicit field order (not object-spread order from the caller) is
 * what makes it stable, and it is the `modelHash` WP4's render cache keys on.
 */
export function serializeChartModel(model: ChartModel): string {
  return JSON.stringify({
    kind: model.kind,
    categories: model.categories,
    series: model.series.map(series => ({
      name: series.name,
      data: series.data.map(serializeDatum),
    })),
    style: {
      ...(model.style.colorScheme === undefined
        ? {}
        : { colorScheme: model.style.colorScheme }),
      ...(model.style.bins === undefined ? {} : { bins: model.style.bins }),
    },
    axes: {
      ...(model.axes.yLabel === undefined ? {} : { yLabel: model.axes.yLabel }),
    },
  })
}

/** Alias kept for callers that think in cache keys (WP4). */
export function chartModelHash(model: ChartModel): string {
  return serializeChartModel(model)
}
