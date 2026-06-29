import { tissueBoxPlotDrawer } from './tissueBoxPlot.ts'

import type { DrawerFunction } from './types.ts'

const registry = new Map<string, DrawerFunction>()

export function registerFeatureChartDrawer(
  name: string,
  drawer: DrawerFunction,
) {
  registry.set(name, drawer)
}

export function getFeatureChartDrawer(
  name: string,
): DrawerFunction | undefined {
  return registry.get(name)
}

export function initBuiltInDrawers() {
  registerFeatureChartDrawer('tissueBoxPlot', tissueBoxPlotDrawer)
}
