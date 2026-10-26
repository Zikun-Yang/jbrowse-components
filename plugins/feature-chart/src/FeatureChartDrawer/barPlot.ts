import { type ChartDatum, DEFAULT_SERIES_NAME } from './chartModel.ts'
import { asDrawerData } from './drawerData.ts'
import { paintChartModel } from './painters.ts'

import type { DrawerFunction, DrawerProps } from './types.ts'

/**
 * Legacy drawer: one numeric value per category (`data.bars`).
 *
 * Adapter only — the bars are painted by the shared bar painter (WP3).
 */

export interface BarEntry {
  name: string
  value: number
  color?: string
}

interface BarPlotData {
  // user data: entries are validated below, not trusted by the type
  bars?: unknown[]
}

export function normalizeBars(raw: unknown): BarEntry[] {
  const { bars } = asDrawerData<BarPlotData>(raw)
  if (!Array.isArray(bars) || bars.length === 0) {
    return []
  }

  return bars
    .map((bar): BarEntry | undefined => {
      if (!bar || typeof bar !== 'object') {
        return undefined
      }
      const { name, value, color } = bar as Partial<BarEntry>
      if (typeof name !== 'string' || !Number.isFinite(value)) {
        return undefined
      }
      return { name, value: value!, ...(color ? { color } : {}) }
    })
    .filter((b): b is BarEntry => b !== undefined)
}

export function barModelFromBars(raw: unknown) {
  const entries = normalizeBars(raw)
  const data: ChartDatum[] = entries.map(entry => ({
    form: 'category-values',
    value: entry.value,
    ...(entry.color === undefined ? {} : { color: entry.color }),
  }))
  return {
    kind: 'bar' as const,
    categories: entries.map(entry => entry.name),
    series: [{ name: DEFAULT_SERIES_NAME, data }],
    style: {},
    axes: {},
  }
}

export const barPlotDrawer: DrawerFunction = function (props: DrawerProps) {
  paintChartModel(props, barModelFromBars(props.data))
}
