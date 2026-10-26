import { type ChartDatum, DEFAULT_SERIES_NAME } from './chartModel.ts'
import { asDrawerData } from './drawerData.ts'
import { paintChartModel } from './painters.ts'

import type { SummaryStats } from './statistics.ts'
import type { DrawerFunction, DrawerProps } from './types.ts'

/**
 * Legacy drawer: precomputed five-number summaries (`data.boxes`).
 *
 * WP3 turned every built-in drawer into an adapter from *its* payload shape to
 * the normalized `ChartModel`; the painting itself lives in `painters.ts`. The
 * public name, the payload contract and the pixels are unchanged, which is what
 * `specEquivalence.test.ts` pins.
 */

interface PrecomputedBoxEntry extends SummaryStats {
  name: string
  color?: string
}

interface PrecomputedBoxPlotData {
  // user data: entries are validated below, not trusted by the type
  boxes?: unknown[]
}

export function normalizeBoxStats(raw: unknown): PrecomputedBoxEntry[] {
  const { boxes } = asDrawerData<PrecomputedBoxPlotData>(raw)
  if (!Array.isArray(boxes) || boxes.length === 0) {
    return []
  }

  return boxes
    .map((box): PrecomputedBoxEntry | undefined => {
      if (!box || typeof box !== 'object') {
        return undefined
      }
      const { name, min, q1, median, q3, max, color } =
        box as Partial<PrecomputedBoxEntry>
      if (
        typeof name !== 'string' ||
        !Number.isFinite(min) ||
        !Number.isFinite(q1) ||
        !Number.isFinite(median) ||
        !Number.isFinite(q3) ||
        !Number.isFinite(max)
      ) {
        return undefined
      }
      return {
        name,
        min: min!,
        q1: q1!,
        median: median!,
        q3: q3!,
        max: max!,
        ...(color ? { color } : {}),
      }
    })
    .filter((b): b is PrecomputedBoxEntry => b !== undefined)
}

/** `data.boxes` → model. Shared with the spec adapter's equivalence test. */
export function boxModelFromPrecomputed(raw: unknown) {
  const entries = normalizeBoxStats(raw)
  const data: ChartDatum[] = entries.map(entry => ({
    form: 'summary-stats',
    stats: {
      min: entry.min,
      q1: entry.q1,
      median: entry.median,
      q3: entry.q3,
      max: entry.max,
    },
    ...(entry.color === undefined ? {} : { color: entry.color }),
  }))
  return {
    kind: 'box' as const,
    categories: entries.map(entry => entry.name),
    series: [{ name: DEFAULT_SERIES_NAME, data }],
    style: {},
    axes: {},
  }
}

export const precomputedBoxPlotDrawer: DrawerFunction = function (
  props: DrawerProps,
) {
  paintChartModel(props, boxModelFromPrecomputed(props.data))
}

/**
 * Legacy drawer: raw observations grouped by tissue (`data.tissues`).
 *
 * Same story as `precomputedBoxPlotDrawer` — the drawer is now a payload adapter
 * and the quartiles are computed by the shared box painter.
 */

interface RawTissueData {
  tissues?: Record<string, number[]>
}

export function normalizeTissueGroups(raw: unknown): [string, number[]][] {
  const { tissues } = asDrawerData<RawTissueData>(raw)
  if (!tissues || typeof tissues !== 'object') {
    return []
  }
  return Object.entries(tissues)
    .map(([name, values]): [string, number[]] | undefined => {
      // `tissues` is user data: a group may hold `null`, a string, or numbers
      // stored as strings. Only finite numbers can be summarized.
      if (!Array.isArray(values)) {
        return undefined
      }
      const finite = values.filter((v): v is number => Number.isFinite(v))
      return finite.length === 0 ? undefined : [name, finite]
    })
    .filter((entry): entry is [string, number[]] => entry !== undefined)
}

export function boxModelFromTissues(raw: unknown) {
  const groups = normalizeTissueGroups(raw)
  const data: ChartDatum[] = groups.map(([, values]) => ({
    form: 'grouped-values',
    values,
  }))
  return {
    kind: 'box' as const,
    categories: groups.map(([name]) => name),
    series: [{ name: DEFAULT_SERIES_NAME, data }],
    style: {},
    axes: {},
  }
}

export const rawBoxPlotDrawer: DrawerFunction = function (props: DrawerProps) {
  paintChartModel(props, boxModelFromTissues(props.data))
}
