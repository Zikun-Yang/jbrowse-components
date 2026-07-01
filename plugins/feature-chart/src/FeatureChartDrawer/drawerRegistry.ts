import { barPlotDrawer } from './barPlot.ts'
import { precomputedBoxPlotDrawer, rawBoxPlotDrawer } from './boxPlot.ts'
import { histogramPlotDrawer } from './histogramPlot.ts'
import { rawViolinPlotDrawer } from './violinPlot.ts'

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
  registerFeatureChartDrawer('precomputedBoxPlot', precomputedBoxPlotDrawer)
  registerFeatureChartDrawer('rawBoxPlot', rawBoxPlotDrawer)
  registerFeatureChartDrawer('rawViolinPlot', rawViolinPlotDrawer)
  registerFeatureChartDrawer('barPlot', barPlotDrawer)
  registerFeatureChartDrawer('histogram', histogramPlotDrawer)
}
