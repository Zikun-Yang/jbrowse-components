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

  export function purge(root: HTMLElement): Promise<void>

  export interface PlotlyModule {
    newPlot: typeof newPlot
    react: typeof react
    purge: typeof purge
  }

  const Plotly: PlotlyModule

  export default Plotly
}
