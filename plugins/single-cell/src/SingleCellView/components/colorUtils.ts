/**
 * Categorical palettes matching common matplotlib / CellXGene defaults.
 */
export const CATEGORICAL_PALETTES: Record<string, string[]> = {
  tab10: [
    '#1f77b4',
    '#ff7f0e',
    '#2ca02c',
    '#d62728',
    '#9467bd',
    '#8c564b',
    '#e377c2',
    '#7f7f7f',
    '#bcbd22',
    '#17becf',
  ],
  tab20: [
    '#1f77b4',
    '#aec7e8',
    '#ff7f0e',
    '#ffbb78',
    '#2ca02c',
    '#98df8a',
    '#d62728',
    '#ff9896',
    '#9467bd',
    '#c5b0d5',
    '#8c564b',
    '#c49c94',
    '#e377c2',
    '#f7b6d2',
    '#7f7f7f',
    '#c7c7c7',
    '#bcbd22',
    '#dbdb8d',
    '#17becf',
    '#9edae5',
  ],
  set1: [
    '#e41a1c',
    '#377eb8',
    '#4daf4a',
    '#984ea3',
    '#ff7f00',
    '#ffff33',
    '#a65628',
    '#f781bf',
    '#999999',
  ],
  set2: [
    '#66c2a5',
    '#fc8d62',
    '#8da0cb',
    '#e78ac3',
    '#a6d854',
    '#ffd92f',
    '#e5c494',
    '#b3b3b3',
  ],
  set3: [
    '#8dd3c7',
    '#ffffb3',
    '#bebada',
    '#fb8072',
    '#80b1d3',
    '#fdb462',
    '#b3de69',
    '#fccde5',
    '#d9d9d9',
    '#bc80bd',
    '#ccebc5',
    '#ffed6f',
  ],
  paired: [
    '#a6cee3',
    '#1f78b4',
    '#b2df8a',
    '#33a02c',
    '#fb9a99',
    '#e31a1c',
    '#fdbf6f',
    '#ff7f00',
    '#cab2d6',
    '#6a3d9a',
    '#ffff99',
    '#b15928',
  ],
  dark2: [
    '#1b9e77',
    '#d95f02',
    '#7570b3',
    '#e7298a',
    '#66a61e',
    '#e6ab02',
    '#a6761d',
    '#666666',
  ],
}

export const DEFAULT_CATEGORICAL_PALETTE = 'tab10'

let customCategoricalPalettes: Record<string, string[]> = {}

export function registerCustomCategoricalPalette(name: string, colors: string[]) {
  customCategoricalPalettes = { ...customCategoricalPalettes, [name]: colors }
}

export function removeCustomCategoricalPalette(name: string) {
  const next = { ...customCategoricalPalettes }
  delete next[name]
  customCategoricalPalettes = next
}

export function getAllCategoricalPaletteNames(): string[] {
  return [
    ...Object.keys(CATEGORICAL_PALETTES),
    ...Object.keys(customCategoricalPalettes),
  ]
}

export function getCategoricalColor(
  index: number,
  paletteName = DEFAULT_CATEGORICAL_PALETTE,
): string {
  const palette =
    CATEGORICAL_PALETTES[paletteName] ??
    customCategoricalPalettes[paletteName] ??
    CATEGORICAL_PALETTES.tab10!
  return palette[index % palette.length]!
}

export function getCategoricalColorRGB(
  index: number,
  paletteName = DEFAULT_CATEGORICAL_PALETTE,
): [number, number, number] {
  const hex = getCategoricalColor(index, paletteName)
  const r = Number.parseInt(hex.slice(1, 3), 16) / 255
  const g = Number.parseInt(hex.slice(3, 5), 16) / 255
  const b = Number.parseInt(hex.slice(5, 7), 16) / 255
  return [r, g, b]
}

/**
 * Continuous colormaps. Each returns [r, g, b] in [0, 1].
 */
export type ContinuousColormap = (t: number) => [number, number, number]

function clamp(t: number): number {
  return Math.max(0, Math.min(1, t))
}

export const CONTINUOUS_PALETTES: Record<string, ContinuousColormap> = {
  viridis(t) {
    t = clamp(t)
    return [
      Math.max(0, Math.min(1, 0.267 + 0.105 * t + 0.63 * t * t - 0.213 * t * t * t)),
      Math.max(0, Math.min(1, 0.004 + 0.898 * t + 0.05 * t * t)),
      Math.max(0, Math.min(1, 0.329 + 0.644 * t - 0.867 * t * t + 0.27 * t * t * t)),
    ]
  },
  plasma(t) {
    t = clamp(t)
    return [
      Math.max(0, Math.min(1, 0.05 + 0.95 * Math.pow(t, 0.7))),
      Math.max(0, Math.min(1, 0.1 + 0.8 * Math.pow(t, 1.2))),
      Math.max(0, Math.min(1, 0.4 + 0.6 * Math.sin(t * Math.PI))),
    ]
  },
  inferno(t) {
    t = clamp(t)
    return [
      Math.max(0, Math.min(1, 0.0015 + 3.8 * t - 12.3 * t * t + 16.5 * t * t * t)),
      Math.max(0, Math.min(1, 0.03 + 1.5 * t - 1.4 * t * t)),
      Math.max(0, Math.min(1, 0.15 + 1.1 * t - 0.7 * t * t)),
    ]
  },
  magma(t) {
    t = clamp(t)
    return [
      Math.max(0, Math.min(1, 0.001 + 2.2 * t + 1.2 * t * t)),
      Math.max(0, Math.min(1, 0.05 + 0.6 * t + 0.4 * t * t)),
      Math.max(0, Math.min(1, 0.2 + 0.8 * t)),
    ]
  },
  cividis(t) {
    t = clamp(t)
    return [
      Math.max(0, Math.min(1, 0.0 + 0.23 * t)),
      Math.max(0, Math.min(1, 0.12 + 0.7 * t)),
      Math.max(0, Math.min(1, 0.3 + 0.5 * t)),
    ]
  },
  coolwarm(t) {
    t = clamp(t)
    // Approximate coolwarm: blue (t=0) -> white (0.5) -> red (1)
    if (t < 0.5) {
      const s = t * 2
      return [s, s, 1]
    }
    const s = (t - 0.5) * 2
    return [1, 1 - s, 1 - s]
  },
  ylOrRd(t) {
    t = clamp(t)
    return [
      Math.max(0, Math.min(1, 1.0)),
      Math.max(0, Math.min(1, 0.4 + 0.6 * t)),
      Math.max(0, Math.min(1, 0.2 * t)),
    ]
  },
}

export const DEFAULT_CONTINUOUS_PALETTE = 'viridis'

let customContinuousPalettes: Record<string, string[]> = {}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.startsWith('#') ? hex : `#${hex}`
  const r = Number.parseInt(normalized.slice(1, 3), 16) / 255
  const g = Number.parseInt(normalized.slice(3, 5), 16) / 255
  const b = Number.parseInt(normalized.slice(5, 7), 16) / 255
  return [r, g, b]
}

function interpolateHexStops(
  stops: string[],
  t: number,
): [number, number, number] {
  t = clamp(t)
  if (stops.length === 0) return [0, 0, 0]
  if (stops.length === 1) return hexToRgb(stops[0]!)
  const scaled = t * (stops.length - 1)
  const i0 = Math.max(0, Math.min(stops.length - 2, Math.floor(scaled)))
  const i1 = i0 + 1
  const localT = scaled - i0
  const [r0, g0, b0] = hexToRgb(stops[i0]!)
  const [r1, g1, b1] = hexToRgb(stops[i1]!)
  return [
    r0 + (r1 - r0) * localT,
    g0 + (g1 - g0) * localT,
    b0 + (b1 - b0) * localT,
  ]
}

function getCustomContinuousColormaps(): Record<string, ContinuousColormap> {
  const maps: Record<string, ContinuousColormap> = {}
  for (const [name, stops] of Object.entries(customContinuousPalettes)) {
    maps[name] = (t: number) => interpolateHexStops(stops, t)
  }
  return maps
}

export function registerCustomContinuousPalette(name: string, stops: string[]) {
  customContinuousPalettes = { ...customContinuousPalettes, [name]: stops }
}

export function removeCustomContinuousPalette(name: string) {
  const next = { ...customContinuousPalettes }
  delete next[name]
  customContinuousPalettes = next
}

export function getAllContinuousPaletteNames(): string[] {
  return [
    ...Object.keys(CONTINUOUS_PALETTES),
    ...Object.keys(customContinuousPalettes),
  ]
}

export function getContinuousRGB(
  t: number,
  paletteName = DEFAULT_CONTINUOUS_PALETTE,
): [number, number, number] {
  const cmap =
    CONTINUOUS_PALETTES[paletteName] ??
    getCustomContinuousColormaps()[paletteName] ??
    CONTINUOUS_PALETTES.viridis!
  return cmap(t)
}

export function getContinuousHex(
  t: number,
  paletteName = DEFAULT_CONTINUOUS_PALETTE,
): string {
  const [r, g, b] = getContinuousRGB(t, paletteName)
  const toHex = (v: number) =>
    Math.round(v * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

/**
 * Backwards-compatible default helpers.
 */
export function viridis(t: number): [number, number, number] {
  return getContinuousRGB(t, 'viridis')
}

export function viridisHex(t: number): string {
  return getContinuousHex(t, 'viridis')
}
