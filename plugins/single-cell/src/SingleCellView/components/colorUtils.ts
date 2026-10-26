/**
 * The palette and quantile helpers now live in @jbrowse/core/util so that
 * other displays (e.g. the canvas feature renderer's score coloring) can share
 * the same palettes. This module re-exports them to keep the single-cell
 * imports stable.
 */
export {
  CATEGORICAL_PALETTES,
  CONTINUOUS_PALETTES,
  DEFAULT_CATEGORICAL_PALETTE,
  DEFAULT_CONTINUOUS_PALETTE,
  buildQuantileContext,
  getAllCategoricalPaletteNames,
  getAllContinuousPaletteNames,
  getCategoricalColor,
  getCategoricalColorRGB,
  getContinuousHex,
  getContinuousRGB,
  getQuantileTs,
  registerCustomCategoricalPalette,
  registerCustomContinuousPalette,
  removeCustomCategoricalPalette,
  removeCustomContinuousPalette,
  valueToQuantile,
  viridis,
  viridisHex,
} from '@jbrowse/core/util'

export type { ContinuousColormap, QuantileContext } from '@jbrowse/core/util'
