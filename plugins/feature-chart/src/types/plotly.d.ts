declare module 'plotly.js-dist-min' {
  // Minimal type declarations for plotly.js-dist-min.
  // This package ships as a single minified UMD bundle without its own types.
  export type PlotType = string

  export interface Data {
    type?: PlotType
    x?: (number | string)[]
    y?: (number | string)[]
    name?: string
    mode?: string
    boxpoints?: boolean | string
    points?: boolean | string
    [key: string]: unknown
  }

  export interface PlotlyAxis {
    tickfont?: Partial<{ size: number }>
    automargin?: boolean
    gridcolor?: string
    linecolor?: string
    zerolinecolor?: string
    [key: string]: unknown
  }

  export interface Layout {
    width?: number
    height?: number
    margin?: Partial<{ l: number; r: number; t: number; b: number }>
    showlegend?: boolean
    xaxis?: PlotlyAxis
    yaxis?: PlotlyAxis
    colorway?: string[]
    font?: Partial<{ size: number; color: string }>
    paper_bgcolor?: string
    plot_bgcolor?: string
    [key: string]: unknown
  }

  export interface Config {
    displayModeBar?: boolean
    staticPlot?: boolean
    [key: string]: unknown
  }

  export function newPlot(
    root: HTMLElement,
    data: Partial<Data>[],
    layout?: Partial<Layout>,
    config?: Partial<Config>,
  ): Promise<void>

  export function react(
    root: HTMLElement,
    data: Partial<Data>[],
    layout?: Partial<Layout>,
    config?: Partial<Config>,
  ): Promise<void>

  /**
   * Best-effort teardown. `plotly.js-dist-min` returns `void` here, while newer
   * builds return a promise, so callers must accept both (see `purgeQuietly`).
   */
  export function purge(root: HTMLElement): void | Promise<void>

  /** Options accepted by `Plotly.toImage()` (subset we use). */
  export interface ToImageOptions {
    format?: 'png' | 'svg' | 'jpeg' | 'webp'
    width?: number
    height?: number
    scale?: number
  }

  export function relayout(
    root: HTMLElement,
    layout: Partial<Layout>,
  ): Promise<unknown>

  /** A data URL for `png`/`svg`; a Blob when the caller asks for one. */
  export function toImage(
    root: HTMLElement,
    opts?: ToImageOptions,
  ): Promise<string | Blob>

  export interface PlotlyModule {
    newPlot: typeof newPlot
    react: typeof react
    purge: typeof purge
    relayout: typeof relayout
    toImage: typeof toImage
  }

  const Plotly: PlotlyModule

  export default Plotly
}
