import {
  type ChartDataForm,
  type ChartDatum,
  type ChartKind,
  type ChartModel,
  DEFAULT_SERIES_NAME,
} from './chartModel.ts'
import { listColorSchemeNames } from './colorSchemes.ts'

import type { SummaryStats } from './statistics.ts'

/**
 * The v1 chart spec vocabulary and its validator (see `SPEC.md`, which is the
 * user-facing contract this file enforces).
 *
 * Two rules shape everything here:
 *
 * 1. **Never throw.** The spec arrives in the RPC worker, where a throw does not
 *    fail one chart, it fails the whole track. Every failure becomes a
 *    structured error the UI can draw.
 * 2. **Errors point at the config and at the data.** `path` says which key is
 *    wrong, `allowed` says what would have been right, and `actualKeys` says
 *    what is actually there — that trio is what makes "shape mismatch"
 *    diagnosable without reading source code, for a person or an agent.
 */

export const CHART_SPEC_VERSION = 1

/**
 * Name of the built-in drawer that renders `renderer.spec`. Both renderers and
 * the maximize dialog compare against this constant instead of a literal.
 */
export const SPEC_DRAWER_NAME = 'spec'

export const CHART_KINDS: ChartKind[] = ['box', 'violin', 'bar', 'histogram']

export const CHART_DATA_FORMS: ChartDataForm[] = [
  'summary-stats',
  'grouped-values',
  'category-values',
  'values',
]

/**
 * The legality matrix. v1 has exactly one row per pre-WP3 built-in drawer, so
 * the spec cannot draw anything the old painters could not — the vocabulary was
 * frozen that way on purpose (SPEC.md §1).
 */
export const CHART_KIND_DATA_FORMS: Record<ChartKind, ChartDataForm[]> = {
  box: ['grouped-values', 'summary-stats'],
  violin: ['grouped-values'],
  bar: ['category-values'],
  histogram: ['values'],
}

export const CHART_BINS_MIN = 1
export const CHART_BINS_MAX = 100
export const DEFAULT_CHART_BINS = 10

const SPEC_KEYS = ['specVersion', 'kind', 'data', 'axes', 'style']
const DATA_KEYS = ['form', 'path']
const AXES_KEYS = ['yLabel']
const STYLE_KEYS = ['colorScheme', 'bins']

/** One structured validation problem, shaped for UI and for agents. */
export interface ChartSpecError {
  /** Dotted path into the config, e.g. `spec.data.form`. */
  path: string
  message: string
  /** Valid values at `path`, when the problem is a closed set. */
  allowed?: string[]
  /** Keys actually present in the offending data, when the problem is a shape. */
  actualKeys?: string[]
}

export interface ChartSpec {
  specVersion: number
  kind: ChartKind
  data: { form: ChartDataForm; path?: string }
  axes?: { yLabel?: string }
  style?: { colorScheme?: string; bins?: number }
}

export type ChartSpecNormalization =
  | { model: ChartModel; errors: [] }
  | { model?: undefined; errors: ChartSpecError[] }

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function quoteList(values: string[], limit = 6): string {
  const shown = values.slice(0, limit).map(value => `"${value}"`)
  const extra = values.length - shown.length
  return `${shown.join(', ')}${extra > 0 ? ` (+${extra} more)` : ''}`
}

/** `"an array of 3"`, `"an object with keys \"tissues\""`, `"null"`, … */
function describeValue(value: unknown): string {
  if (value === undefined) {
    return 'nothing'
  }
  if (value === null) {
    return 'null'
  }
  if (Array.isArray(value)) {
    return `an array of ${value.length}`
  }
  if (isPlainObject(value)) {
    const keys = Object.keys(value)
    return keys.length === 0
      ? 'an empty object'
      : `an object with keys ${quoteList(keys)}`
  }
  if (typeof value === 'string') {
    return `the string "${value.slice(0, 32)}"`
  }
  return `a ${typeof value}`
}

/** `actualKeys` for an object, or for the first object inside an array. */
function actualKeysOf(value: unknown): string[] | undefined {
  if (isPlainObject(value)) {
    return Object.keys(value)
  }
  if (Array.isArray(value)) {
    const first = value.find(isPlainObject)
    return first ? Object.keys(first) : undefined
  }
  return undefined
}

function unknownKeys(
  value: Record<string, unknown>,
  known: string[],
  path: string,
  errors: ChartSpecError[],
) {
  const extra = Object.keys(value).filter(key => !known.includes(key))
  if (extra.length === 0) {
    return
  }
  errors.push({
    path,
    message: `unknown key${extra.length === 1 ? '' : 's'} ${quoteList(extra)}; allowed: ${known.join(', ')}`,
    allowed: known,
    actualKeys: Object.keys(value),
  })
}

/**
 * Structural validation: everything that can be decided without looking at the
 * feature payload. Run once per render; a failure draws one placeholder for the
 * whole track instead of one per chart.
 */
export function validateChartSpec(spec: unknown): ChartSpecError[] {
  const errors: ChartSpecError[] = []
  if (!isPlainObject(spec)) {
    errors.push({
      path: 'spec',
      message: `spec must be an object; found ${describeValue(spec)}`,
    })
    return errors
  }
  unknownKeys(spec, SPEC_KEYS, 'spec', errors)

  const version = spec.specVersion
  if (version === undefined) {
    errors.push({
      path: 'spec.specVersion',
      message: `specVersion is required (currently ${CHART_SPEC_VERSION})`,
      allowed: [String(CHART_SPEC_VERSION)],
    })
  } else if (typeof version !== 'number' || !Number.isInteger(version)) {
    errors.push({
      path: 'spec.specVersion',
      message: `specVersion must be an integer; found ${describeValue(version)}`,
      allowed: [String(CHART_SPEC_VERSION)],
    })
  } else if (version > CHART_SPEC_VERSION) {
    errors.push({
      path: 'spec.specVersion',
      message: `specVersion ${version} is newer than this build supports (${CHART_SPEC_VERSION}). Update BioSeek / JBrowse to render this chart.`,
      allowed: [String(CHART_SPEC_VERSION)],
    })
  } else if (version < 1) {
    errors.push({
      path: 'spec.specVersion',
      message: `specVersion ${version} is not supported; the v1 vocabulary starts at 1`,
      allowed: [String(CHART_SPEC_VERSION)],
    })
  }

  const kind = spec.kind
  const kindIsValid =
    typeof kind === 'string' && CHART_KINDS.includes(kind as ChartKind)
  if (!kindIsValid) {
    errors.push({
      path: 'spec.kind',
      message: `"${String(kind)}" is not a chart kind`,
      allowed: [...CHART_KINDS],
      actualKeys: Object.keys(spec),
    })
  }

  const data = spec.data
  if (!isPlainObject(data)) {
    errors.push({
      path: 'spec.data',
      message: `data is required: { "form": "…", "path": "…" }; found ${describeValue(data)}`,
      allowed: [...CHART_DATA_FORMS],
    })
  } else {
    unknownKeys(data, DATA_KEYS, 'spec.data', errors)

    const form = data.form
    const formIsValid =
      typeof form === 'string' && CHART_DATA_FORMS.includes(form as ChartDataForm)
    if (!formIsValid) {
      errors.push({
        path: 'spec.data.form',
        message: `"${String(form)}" is not a data form`,
        allowed: [...CHART_DATA_FORMS],
      })
    } else if (kindIsValid) {
      const allowed = CHART_KIND_DATA_FORMS[kind as ChartKind]
      if (!allowed.includes(form as ChartDataForm)) {
        errors.push({
          path: 'spec.data.form',
          message: `spec.kind "${String(kind)}" does not accept data.form "${String(form)}"`,
          allowed: [...allowed],
          actualKeys: Object.keys(data),
        })
      }
    }

    if (data.path !== undefined && typeof data.path !== 'string') {
      errors.push({
        path: 'spec.data.path',
        message: `path must be a dotted string; found ${describeValue(data.path)}`,
      })
    }
  }

  const axes = spec.axes
  if (axes !== undefined) {
    if (!isPlainObject(axes)) {
      errors.push({
        path: 'spec.axes',
        message: `axes must be an object; found ${describeValue(axes)}`,
        allowed: [...AXES_KEYS],
      })
    } else {
      unknownKeys(axes, AXES_KEYS, 'spec.axes', errors)
      if (axes.yLabel !== undefined && typeof axes.yLabel !== 'string') {
        errors.push({
          path: 'spec.axes.yLabel',
          message: `yLabel must be a string; found ${describeValue(axes.yLabel)}`,
        })
      }
    }
  }

  const style = spec.style
  if (style !== undefined) {
    if (!isPlainObject(style)) {
      errors.push({
        path: 'spec.style',
        message: `style must be an object; found ${describeValue(style)}`,
        allowed: [...STYLE_KEYS],
      })
    } else {
      unknownKeys(style, STYLE_KEYS, 'spec.style', errors)

      if (style.colorScheme !== undefined) {
        const names = listColorSchemeNames()
        if (
          typeof style.colorScheme !== 'string' ||
          !names.includes(style.colorScheme)
        ) {
          errors.push({
            path: 'spec.style.colorScheme',
            message: `"${String(style.colorScheme)}" is not a palette`,
            allowed: names,
          })
        }
      }

      if (style.bins !== undefined) {
        const bins = style.bins
        if (
          typeof bins !== 'number' ||
          !Number.isInteger(bins) ||
          bins < CHART_BINS_MIN ||
          bins > CHART_BINS_MAX
        ) {
          errors.push({
            path: 'spec.style.bins',
            message: `bins must be an integer between ${CHART_BINS_MIN} and ${CHART_BINS_MAX}; found ${describeValue(bins)}`,
          })
        } else if (kindIsValid && kind !== 'histogram') {
          errors.push({
            path: 'spec.style.bins',
            message: `style.bins only applies to kind "histogram"; kind is "${String(kind)}"`,
            allowed: ['histogram'],
          })
        }
      }
    }
  }

  return errors
}

interface PathResolution {
  value?: unknown
  error?: ChartSpecError
}

/**
 * Dot-path lookup: `""` → root, `a.b.c` → nested keys, numeric segments index
 * arrays. Nothing else — no wildcards, no expressions (SPEC.md §3).
 */
export function resolveDataPath(data: unknown, path: string): PathResolution {
  if (path === '') {
    return { value: data }
  }
  const segments = path.split('.')
  let current: unknown = data
  let walked = ''
  for (const segment of segments) {
    walked = walked === '' ? segment : `${walked}.${segment}`
    if (Array.isArray(current)) {
      if (!/^\d+$/.test(segment)) {
        return {
          error: {
            path: 'spec.data.path',
            message: `spec.data.path "${path}" does not resolve: "${walked}" needs an array index, "${segment}" is not one`,
            actualKeys: current.length === 0 ? [] : [`0..${current.length - 1}`],
          },
        }
      }
      current = current[Number(segment)]
      continue
    }
    if (!isPlainObject(current)) {
      return {
        error: {
          path: 'spec.data.path',
          message: `spec.data.path "${path}" does not resolve: nothing is reachable at "${walked}"`,
          actualKeys: actualKeysOf(current),
        },
      }
    }
    if (!(segment in current)) {
      return {
        error: {
          path: 'spec.data.path',
          message: `spec.data.path "${path}" does not resolve: missing key "${segment}" at "${walked === segment ? '' : walked.slice(0, walked.length - segment.length - 1) || 'the root'}"`,
          actualKeys: Object.keys(current),
        },
      }
    }
    current = current[segment]
  }
  return { value: current }
}

function finiteNumbers(values: unknown[]): number[] {
  return values.filter(
    (value): value is number =>
      typeof value === 'number' && Number.isFinite(value),
  )
}

interface FormExtraction {
  categories: string[]
  data: ChartDatum[]
  error?: ChartSpecError
}

function extractSummaryStats(value: unknown): FormExtraction {
  if (!Array.isArray(value)) {
    return {
      categories: [],
      data: [],
      error: {
        path: 'spec.data.form',
        message: `data.form "summary-stats" expects an array of { name, min, q1, median, q3, max }; found ${describeValue(value)}`,
        actualKeys: actualKeysOf(value),
      },
    }
  }
  const categories: string[] = []
  const data: ChartDatum[] = []
  for (const box of value) {
    if (!isPlainObject(box) || typeof box.name !== 'string') {
      continue
    }
    const stats: SummaryStats = {
      min: box.min as number,
      q1: box.q1 as number,
      median: box.median as number,
      q3: box.q3 as number,
      max: box.max as number,
    }
    if (
      !Number.isFinite(stats.min) ||
      !Number.isFinite(stats.q1) ||
      !Number.isFinite(stats.median) ||
      !Number.isFinite(stats.q3) ||
      !Number.isFinite(stats.max)
    ) {
      continue
    }
    categories.push(box.name)
    data.push({
      form: 'summary-stats',
      stats,
      ...(typeof box.color === 'string' ? { color: box.color } : {}),
    })
  }
  if (value.length > 0 && data.length === 0) {
    return {
      categories,
      data,
      error: {
        path: 'spec.data.form',
        message:
          'data.form "summary-stats" found no usable entry: each needs a string name and finite min/q1/median/q3/max',
        actualKeys: actualKeysOf(value),
      },
    }
  }
  return { categories, data }
}

function extractGroupedValues(value: unknown): FormExtraction {
  if (!isPlainObject(value)) {
    return {
      categories: [],
      data: [],
      error: {
        path: 'spec.data.form',
        message: `data.form "grouped-values" expects an object mapping category → number[]; found ${describeValue(value)}`,
        actualKeys: actualKeysOf(value),
      },
    }
  }
  const categories: string[] = []
  const data: ChartDatum[] = []
  for (const [name, rawValues] of Object.entries(value)) {
    if (!Array.isArray(rawValues)) {
      continue
    }
    const values = finiteNumbers(rawValues)
    if (values.length === 0) {
      continue
    }
    categories.push(name)
    data.push({ form: 'grouped-values', values })
  }
  if (Object.keys(value).length > 0 && data.length === 0) {
    return {
      categories,
      data,
      error: {
        path: 'spec.data.form',
        message:
          'data.form "grouped-values" found no group with finite numbers; each value must be a number[]',
        actualKeys: Object.keys(value),
      },
    }
  }
  return { categories, data }
}

function extractCategoryValues(value: unknown): FormExtraction {
  if (!Array.isArray(value)) {
    return {
      categories: [],
      data: [],
      error: {
        path: 'spec.data.form',
        message: `data.form "category-values" expects an array of { name, value }; found ${describeValue(value)}`,
        actualKeys: actualKeysOf(value),
      },
    }
  }
  const categories: string[] = []
  const data: ChartDatum[] = []
  for (const bar of value) {
    if (!isPlainObject(bar) || typeof bar.name !== 'string') {
      continue
    }
    if (typeof bar.value !== 'number' || !Number.isFinite(bar.value)) {
      continue
    }
    categories.push(bar.name)
    data.push({
      form: 'category-values',
      value: bar.value,
      ...(typeof bar.color === 'string' ? { color: bar.color } : {}),
    })
  }
  if (value.length > 0 && data.length === 0) {
    return {
      categories,
      data,
      error: {
        path: 'spec.data.form',
        message:
          'data.form "category-values" found no usable entry: each needs a string name and a finite value',
        actualKeys: actualKeysOf(value),
      },
    }
  }
  return { categories, data }
}

function extractValues(value: unknown): FormExtraction {
  if (!Array.isArray(value)) {
    return {
      categories: [],
      data: [],
      error: {
        path: 'spec.data.form',
        message: `data.form "values" expects a number[]; found ${describeValue(value)}`,
        actualKeys: actualKeysOf(value),
      },
    }
  }
  const values = finiteNumbers(value)
  return {
    categories: [],
    data: values.length === 0 ? [] : [{ form: 'values', values }],
  }
}

function extract(form: ChartDataForm, value: unknown): FormExtraction {
  switch (form) {
    case 'summary-stats':
      return extractSummaryStats(value)
    case 'grouped-values':
      return extractGroupedValues(value)
    case 'category-values':
      return extractCategoryValues(value)
    case 'values':
      return extractValues(value)
  }
}

/**
 * Validate a spec against one feature's payload and produce the normalized
 * model the painters consume. Structural problems are reported without touching
 * the payload, so the same call site can render one placeholder for the track.
 */
export function normalizeFromSpec(
  spec: unknown,
  data: unknown,
): ChartSpecNormalization {
  const structural = validateChartSpec(spec)
  if (structural.length > 0) {
    return { errors: structural }
  }
  return normalizeValidatedSpec(spec as ChartSpec, data)
}

/**
 * The per-chart half of `normalizeFromSpec`, for callers that already ran
 * `validateChartSpec()` once (a track with 100 charts must not validate the
 * same config 100 times).
 */
export function normalizeValidatedSpec(
  spec: ChartSpec,
  data: unknown,
): ChartSpecNormalization {
  const form = spec.data.form
  const path = spec.data.path ?? ''
  const resolved = resolveDataPath(data, path)
  if (resolved.error) {
    return { errors: [resolved.error] }
  }
  const extraction = extract(form, resolved.value)
  if (extraction.error) {
    return { errors: [extraction.error] }
  }

  const style: ChartModel['style'] = {}
  if (spec.style?.colorScheme !== undefined) {
    style.colorScheme = spec.style.colorScheme
  }
  if (spec.style?.bins !== undefined) {
    style.bins = spec.style.bins
  }
  const axes: ChartModel['axes'] = {}
  if (spec.axes?.yLabel !== undefined && spec.axes.yLabel !== '') {
    axes.yLabel = spec.axes.yLabel
  }

  return {
    model: {
      kind: spec.kind,
      categories: extraction.categories,
      series: [{ name: DEFAULT_SERIES_NAME, data: extraction.data }],
      style,
      axes,
    },
    errors: [],
  }
}

/** One line for a placeholder: `spec.data.form: …` plus what was allowed. */
export function formatChartSpecError(error: ChartSpecError): string {
  const allowed =
    error.allowed && error.allowed.length > 0
      ? ` (allowed: ${error.allowed.join(', ')})`
      : ''
  return `${error.path}: ${error.message}${allowed}`
}

/** Multi-line body for the maximize dialog's `Alert`. */
export function formatChartSpecErrors(errors: ChartSpecError[]): string[] {
  return errors.map(formatChartSpecError)
}
