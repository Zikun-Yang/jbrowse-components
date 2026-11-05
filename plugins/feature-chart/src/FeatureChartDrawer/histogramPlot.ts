import { type ChartDatum, DEFAULT_SERIES_NAME } from './chartModel.ts'
import { asDrawerData } from './drawerData.ts'
import { paintChartModel } from './painters.ts'

import type { DrawerFunction, DrawerProps } from './types.ts'

/**
 * Legacy drawer: frequency histogram of one numeric series (`data.values`).
 *
 * Adapter only. `data.bins` (this drawer's own payload key, predating the spec)
 * is mapped onto `ChartModel.style.bins`, so an existing config keeps working;
 * new configs set `spec.style.bins` instead.
 */

interface HistogramData {
  values?: number[]
  bins?: number
}

export function normalizeHistogramValues(raw: unknown): number[] {
  const { values } = asDrawerData<HistogramData>(raw)
  if (!Array.isArray(values) || values.length === 0) {
    return []
  }
  return values.filter((v): v is number => Number.isFinite(v))
}

export function histogramModelFromValues(raw: unknown) {
  const payload = asDrawerData<HistogramData>(raw)
  const values = normalizeHistogramValues(raw)
  // `data.bins` is optional in this drawer's payload; when it is absent the
  // painter's default applies, so the model carries no `bins` at all. That keeps
  // the legacy model and its spec equivalent byte-identical.
  const bins =
    typeof payload.bins === 'number' && payload.bins > 0
      ? { bins: payload.bins }
      : {}
  const data: ChartDatum[] =
    values.length === 0 ? [] : [{ form: 'values', values }]
  return {
    kind: 'histogram' as const,
    categories: [] as string[],
    series: [{ name: DEFAULT_SERIES_NAME, data }],
    style: bins,
    axes: {},
  }
}

export const histogramPlotDrawer: DrawerFunction = function (props: DrawerProps) {
  paintChartModel(props, histogramModelFromValues(props.data))
}
