import { colord } from '@jbrowse/core/util/colord'

export const MAX_COLOR_RANGE = 255 * 255 * 255 // max color range

export const lineLimit = 3

export const oobLimit = 1600

export function makeColor(idx: number) {
  const r = Math.floor(idx / (255 * 255)) % 255
  const g = Math.floor(idx / 255) % 255
  const b = idx % 255
  return `rgb(${r},${g},${b})`
}

export function getId(r: number, g: number, b: number, unitMultiplier: number) {
  return Math.floor((r * 255 * 255 + g * 255 + b - 1) / unitMultiplier)
}

// CIGAR operation colors, used for insertion/deletion ops in every colorBy
// mode (match ops get the mode-specific color instead)
export const cigarColors = {
  I: '#ff03',
  N: '#a020f0', // Purple for deletion
  D: '#a020f0', // Purple for deletion
  X: 'brown',
  M: '#f003',
  '=': '#f003',
}

export const strandPosColor = '#757575'
// fallback only; the display model prefers the session theme's primary color
// for the reverse strand
export const strandNegColor = '#4caf50'

// identity below this is rendered as the low end of the scale
export const IDENTITY_WINDOW_LO = 0.85

// traffic-light scale anchored at the theme primary's hue: themeHue -> yellow
// (55) -> red (0), interpolated as two hue segments so the midpoint stays a
// clean yellow instead of the muddy brown an RGB lerp would give
export function getIdentityColor(
  identity: number | undefined,
  themeHue: number,
) {
  if (identity === undefined) {
    return '#999999'
  }
  const t = Math.min(
    1,
    Math.max(0, (identity - IDENTITY_WINDOW_LO) / (1 - IDENTITY_WINDOW_LO)),
  )
  const hue =
    t < 0.5
      ? themeHue + (55 - themeHue) * (t * 2)
      : 55 + (0 - 55) * ((t - 0.5) * 2)
  // round to keep stable color strings in the face of floating point noise
  return `hsl(${Math.round(hue * 100) / 100}, 70%, 45%)`
}

// position along the anchor chromosome as a fraction of its length: 0 (5')
// is blue-violet, 1 (3') is red. keyed to genomic coordinate, not pixel, so
// horizontally flipped views keep the same colors
export function getRainbowColor(frac: number) {
  const f = Math.min(1, Math.max(0, frac))
  return `hsl(${260 * (1 - f)}, 75%, 50%)`
}

export function applyAlpha(color: string, alpha: number) {
  // Skip colord processing if alpha is 1 (optimization)
  if (alpha === 1) {
    return color
  }
  return colord(color).alpha(alpha).toHex()
}
