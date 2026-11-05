import { type ChartDatum, DEFAULT_SERIES_NAME } from './chartModel.ts'
import { asDrawerData } from './drawerData.ts'
import { paintChartModel } from './painters.ts'

import type { DrawerFunction, DrawerProps } from './types.ts'

/**
 * Legacy drawer: kernel-density violin per tissue (`data.tissues`).
 *
 * Adapter only — the KDE and the paths are painted by the shared violin painter
 * (WP3). `statistics.ts` owns the bandwidth/KDE math it shares with the box
 * painter.
 */

interface RawTissueData {
  tissues?: Record<string, number[]>
}

export function normalizeViolinGroups(raw: unknown): [string, number[]][] {
  const { tissues } = asDrawerData<RawTissueData>(raw)
  if (!tissues || typeof tissues !== 'object') {
    return []
  }
  return Object.entries(tissues)
    .map(([name, rawValues]): [string, number[]] | undefined => {
      if (!Array.isArray(rawValues)) {
        return undefined
      }
      const values = rawValues.filter((value): value is number =>
        Number.isFinite(value),
      )
      return values.length === 0 ? undefined : [name, values]
    })
    .filter((entry): entry is [string, number[]] => entry !== undefined)
}

export function violinModelFromTissues(raw: unknown) {
  const groups = normalizeViolinGroups(raw)
  const data: ChartDatum[] = groups.map(([, values]) => ({
    form: 'grouped-values',
    values,
  }))
  return {
    kind: 'violin' as const,
    categories: groups.map(([name]) => name),
    series: [{ name: DEFAULT_SERIES_NAME, data }],
    style: {},
    axes: {},
  }
}

export const rawViolinPlotDrawer: DrawerFunction = function (props: DrawerProps) {
  paintChartModel(props, violinModelFromTissues(props.data))
}
