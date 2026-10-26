import type { ThemeOptions } from '@mui/material'

/**
 * Named categorical palettes available to every built-in drawer through the
 * `colorScheme` renderer config slot.
 *
 * Keep every color a `#rrggbb` string: drawers derive translucent fills by
 * appending an alpha suffix (`color + '33'`), which only works for hex colors.
 */
const PALETTES: Record<string, string[]> = {
  tableau10: [
    '#4e79a7',
    '#f28e2c',
    '#e15759',
    '#76b7b2',
    '#59a14f',
    '#edc949',
    '#af7aa1',
    '#ff9da7',
    '#9c755f',
    '#bab0ab',
  ],
  viridis: [
    '#440154',
    '#482878',
    '#3e4989',
    '#31688e',
    '#26828e',
    '#1f9e89',
    '#35b779',
    '#6ece58',
    '#b5de2b',
    '#fde725',
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
  blues: [
    '#f7fbff',
    '#deebf7',
    '#c6dbef',
    '#9ecae1',
    '#6baed6',
    '#4292c6',
    '#2171b5',
    '#08519c',
    '#08306b',
  ],
}

export const DEFAULT_COLOR_SCHEME = 'tableau10'

export interface FeatureChartColorScheme {
  /** Resolved palette name (falls back to {@link DEFAULT_COLOR_SCHEME}). */
  name: string
  /** Categorical colors, already adjusted for the active theme. */
  colors: string[]
  /** Chart panel background. */
  background: string
  /** Grid lines. */
  grid: string
  /** Axis lines and median marks. */
  axis: string
  /** Tick and category labels. */
  text: string
  /** Secondary lines such as whiskers. */
  muted: string
}

const LIGHT_CHROME = {
  background: '#fafafa',
  grid: '#e0e0e0',
  axis: '#333333',
  text: '#333333',
  muted: '#555555',
}

// In dark mode the panel follows the theme and the palette is lightened, so
// thin 8-12px labels and dark palette entries (viridis, blues) stay legible.
const DARK_CHROME = {
  background: '#2b2b2b',
  grid: '#4a4a4a',
  axis: '#e0e0e0',
  text: '#ededed',
  muted: '#bdbdbd',
}

function compareNames(a: string, b: string) {
  return a < b ? -1 : a > b ? 1 : 0
}

/** Palette names, sorted deterministically (safe to show in UI/agent output). */
export function listColorSchemeNames(): string[] {
  return Object.keys(PALETTES).sort(compareNames)
}

export function isColorSchemeName(name: string | undefined | null): boolean {
  return typeof name === 'string' && name in PALETTES
}

/** Blend a `#rrggbb` color towards white; other color formats pass through. */
function lighten(color: string, amount: number): string {
  const match = /^#([\da-f]{6})$/i.exec(color)
  if (!match) {
    return color
  }
  const value = Number.parseInt(match[1]!, 16)
  const channels = [value >> 16, (value >> 8) & 0xff, value & 0xff]
  return `#${channels
    .map(channel => {
      const mixed = Math.round(channel + (255 - channel) * amount)
      return mixed.toString(16).padStart(2, '0')
    })
    .join('')}`
}

const warnedSchemes = new Set<string>()

/**
 * Resolve a `colorScheme` config value into concrete colors for the active
 * theme. Unknown names fall back to {@link DEFAULT_COLOR_SCHEME} and warn once,
 * so a typo produces one console line instead of one per rendered chart.
 */
export function resolveColorScheme(
  theme?: Partial<ThemeOptions> | null,
  name?: string | null,
): FeatureChartColorScheme {
  if (name && !isColorSchemeName(name) && !warnedSchemes.has(name)) {
    warnedSchemes.add(name)
    console.warn(
      `[feature-chart] Unknown colorScheme "${name}", falling back to "${DEFAULT_COLOR_SCHEME}". Available: ${listColorSchemeNames().join(', ')}`,
    )
  }

  const resolvedName = isColorSchemeName(name) ? name! : DEFAULT_COLOR_SCHEME
  const palette = PALETTES[resolvedName]!
  const isDark = theme?.palette?.mode === 'dark'

  return {
    name: resolvedName,
    colors: isDark ? palette.map(color => lighten(color, 0.28)) : [...palette],
    ...(isDark ? DARK_CHROME : LIGHT_CHROME),
  }
}

export function getColorSchemeColors(name?: string | null): string[] {
  return resolveColorScheme(null, name).colors
}
