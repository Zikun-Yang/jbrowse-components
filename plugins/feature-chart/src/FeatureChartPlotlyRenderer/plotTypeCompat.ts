import { CHART_KINDS, type ChartSpec } from '../FeatureChartDrawer/chartSpec.ts'

import type { ChartKind } from '../FeatureChartDrawer/chartModel.ts'

/**
 * `plotType` is the pre-WP4 Plotly-only knob. It is kept as a **deprecated
 * compatibility alias** for `spec.kind` and nothing else (see
 * `FeatureChartTrack.md` §7): a config written before the two backends were
 * unified keeps rendering, and it gets one console warning naming the exact
 * `spec` that means the same thing.
 *
 * The alias only applies when the track did **not** choose its own chart, i.e.
 * when `drawer` is still the schema default. Otherwise `drawer` wins: the user
 * asked for a named chart, and the Plotly backend now honours that.
 *
 * `scatter` and `line` are the exception: they were never part of the v1
 * vocabulary (no canvas painter exists for them, so a canvas track could never
 * draw one). They keep their legacy Plotly behaviour under the same deprecation
 * warning and are removed in v2 — `legacyPlotTypeTraces()` is the only caller.
 */

export const LEGACY_PLOT_TYPES = [
  'box',
  'bar',
  'scatter',
  'line',
  'violin',
] as const

export type LegacyPlotType = (typeof LEGACY_PLOT_TYPES)[number]

/** plotType values that map onto a v1 `ChartKind`. */
const PLOT_TYPE_KINDS: Partial<Record<LegacyPlotType, ChartKind>> = {
  box: 'box',
  violin: 'violin',
  bar: 'bar',
}

/** plotType values with no model in v1: kept only through the legacy builder. */
const LEGACY_ONLY_PLOT_TYPES: LegacyPlotType[] = ['scatter', 'line']

export function isLegacyOnlyPlotType(
  plotType: string,
): plotType is 'scatter' | 'line' {
  return (LEGACY_ONLY_PLOT_TYPES as string[]).includes(plotType)
}

export interface PlotTypeAlias {
  /** The equivalent `spec`, when this payload is expressible as a model. */
  spec?: ChartSpec
  /** The payload the spec should read, after legacy reshaping. */
  data?: unknown
  /** Why no spec could be built (the caller shows it instead of a chart). */
  error?: string
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function summaryStatsOf(entry: unknown): boolean {
  return (
    isPlainObject(entry) &&
    typeof entry.name === 'string' &&
    isFiniteNumber(entry.min) &&
    isFiniteNumber(entry.q1) &&
    isFiniteNumber(entry.median) &&
    isFiniteNumber(entry.q3) &&
    isFiniteNumber(entry.max)
  )
}

function categoryValuesOf(entry: unknown): boolean {
  return (
    isPlainObject(entry) &&
    typeof entry.name === 'string' &&
    isFiniteNumber(entry.value)
  )
}

function groupedValues(data: unknown): boolean {
  if (!isPlainObject(data)) {
    return false
  }
  const values = Object.values(data)
  return (
    values.length > 0 &&
    values.every(
      value => Array.isArray(value) && value.some(item => isFiniteNumber(item)),
    )
  )
}

/**
 * Payload keys the built-in drawers read. A legacy Plotly track was configured
 * against the same `contextData.data`, i.e. `{ tissues: {...} }` or
 * `{ boxes: [...] }` — the old renderer iterated those *wrapper* objects and
 * therefore never worked with the documented adapter payload. Unwrapping a
 * known single-key wrapper is what makes an old config render the chart it was
 * clearly meant to draw, without guessing at arbitrary objects (a single
 * category named `Brain` must stay a category, not become the root).
 */
const PAYLOAD_WRAPPERS = new Set(['tissues', 'boxes', 'bars', 'values', 'data'])

function unwrapPayload(data: unknown): unknown {
  if (!isPlainObject(data)) {
    return data
  }
  const keys = Object.keys(data)
  if (keys.length !== 1 || !PAYLOAD_WRAPPERS.has(keys[0]!)) {
    return data
  }
  return data[keys[0]!]
}

function mean(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

/**
 * Translate a `plotType` + payload into the `spec` (+ reshaped payload) that
 * draws the same chart through the unified pipeline.
 *
 * Every branch keeps the *old* renderer's interpretation of the payload, so a
 * legacy config is not silently redrawn: a `bar` plotType over grouped values
 * has always averaged the group, and still does.
 */
export function plotTypeToSpec(
  plotType: string,
  rawData: unknown,
): PlotTypeAlias {
  const data = unwrapPayload(rawData)
  if (isLegacyOnlyPlotType(plotType)) {
    return {
      error: `plotType "${plotType}" has no ChartModel in the v1 vocabulary. See FeatureChartTrack.md §7 for the migration (it keeps its legacy Plotly rendering for now).`,
    }
  }

  const kind = PLOT_TYPE_KINDS[plotType as LegacyPlotType]
  if (!kind || !(CHART_KINDS as string[]).includes(kind)) {
    return {
      error: `plotType "${plotType}" is not a chart kind; use drawer: "spec" with spec.kind (${CHART_KINDS.join(', ')})`,
    }
  }

  // `[{ name, min, q1, median, q3, max }]` → box summary statistics.
  if (Array.isArray(data) && data.length > 0 && data.every(summaryStatsOf)) {
    return kind === 'box'
      ? {
          spec: {
            specVersion: 1,
            kind,
            data: { form: 'summary-stats', path: '' },
          },
          data,
        }
      : {
          error: `plotType "${plotType}" cannot use precomputed five-number summaries; use spec.kind "box" with data.form "summary-stats"`,
        }
  }

  // `[{ name, value }]` → one bar per category.
  if (Array.isArray(data) && data.length > 0 && data.every(categoryValuesOf)) {
    return kind === 'bar'
      ? {
          spec: {
            specVersion: 1,
            kind,
            data: { form: 'category-values', path: '' },
          },
          data,
        }
      : {
          error: `plotType "${plotType}" cannot use { name, value } entries; use spec.kind "bar" with data.form "category-values"`,
        }
  }

  // `{ category: number[] }` → grouped observations.
  if (groupedValues(data)) {
    if (kind === 'bar') {
      // The pre-WP4 renderer averaged each group for a bar chart. Keep that.
      const bars = Object.entries(data as Record<string, number[]>).map(
        ([name, values]) => ({
          name,
          value: mean(values.filter(isFiniteNumber)),
        }),
      )
      return {
        spec: {
          specVersion: 1,
          kind: 'bar',
          data: { form: 'category-values', path: '' },
        },
        data: bars,
      }
    }
    return {
      spec: {
        specVersion: 1,
        kind,
        data: { form: 'grouped-values', path: '' },
      },
      data,
    }
  }

  // `{ category: number }` → one bar per category.
  if (isPlainObject(data) && Object.values(data).every(isFiniteNumber)) {
    if (kind === 'bar') {
      return {
        spec: {
          specVersion: 1,
          kind,
          data: { form: 'category-values', path: '' },
        },
        data: Object.entries(data).map(([name, value]) => ({
          name,
          value: value as number,
        })),
      }
    }
  }

  return {
    error: `plotType "${plotType}" does not recognize this payload shape (${describePayload(data)}); use drawer: "spec" — FeatureChartTrack.md §7 has the mapping table`,
  }
}

function describePayload(data: unknown): string {
  if (Array.isArray(data)) {
    return `an array of ${data.length}`
  }
  if (isPlainObject(data)) {
    const keys = Object.keys(data)
    return keys.length === 0
      ? 'an empty object'
      : `an object with keys ${keys.slice(0, 4).join(', ')}`
  }
  return `a ${data === null ? 'null' : typeof data}`
}

const warnedPlotTypes = new Set<string>()

/**
 * One warning per `plotType` per page. Deprecations are user-facing: a config
 * that will stop working in v2 must say so in the console of a production build
 * too, unlike the development-only `drawerOptions` hint.
 */
export function warnPlotTypeDeprecated(
  plotType: string,
  spec: ChartSpec | undefined,
): void {
  if (warnedPlotTypes.has(plotType)) {
    return
  }
  warnedPlotTypes.add(plotType)
  const migration = spec
    ? ` Equivalent config: "drawer": "spec", "spec": ${JSON.stringify(spec)}`
    : ' See FeatureChartTrack.md §7 for the migration.'
  console.warn(
    `[feature-chart] plotType "${plotType}" is deprecated and will be removed in v2; use a chart spec instead.${migration}`,
  )
}

/** Test helper: forget the warn-once state. */
export function resetPlotTypeDeprecationWarnings() {
  warnedPlotTypes.clear()
}
