import type { Config as PlotlyConfig, PlotlyModule } from 'plotly.js-dist-min'

/**
 * The one place `plotly.js-dist-min` is imported, and it is a **dynamic**
 * import: the library stays in its own bundle chunk and is only fetched when a
 * Plotly chart actually mounts (the in-track Plotly renderer, or the maximize
 * dialog's interactive view after the user asks for it). One lazy boundary, not
 * one per component.
 */

let plotlyPromise: Promise<PlotlyModule> | undefined

export function loadPlotly(): Promise<PlotlyModule> {
  plotlyPromise ??= import('plotly.js-dist-min').then(module => {
    // The package ships a CommonJS/UMD bundle; depending on the interop layer
    // the module is either `{ default: Plotly }` or Plotly itself.
    const candidate = module as unknown as {
      default?: PlotlyModule
      newPlot?: PlotlyModule['newPlot']
    }
    return candidate.default ?? (module as unknown as PlotlyModule)
  })
  return plotlyPromise
}

/**
 * Handle the maximize dialog needs to export the interactive chart: the DOM
 * node Plotly drew into, and the module to call `toImage` on.
 */
export interface PlotlyExportHandle {
  node: HTMLElement
  plotly: PlotlyModule
}

export const PLOTLY_INLINE_CONFIG: PlotlyConfig = {
  displayModeBar: false,
  staticPlot: false,
  responsive: false,
}
