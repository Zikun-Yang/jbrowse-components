import type { FeatureChartColorScheme } from './colorSchemes.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'
import type { Region } from '@jbrowse/core/util/types'
import type { ThemeOptions } from '@mui/material'

/**
 * Coarse description of the JSON payload a drawer expects, used by UI and
 * agents to filter the drawer catalog before rendering anything.
 */
export type FeatureChartDrawerDataShape =
  | 'tissues'
  | 'matrix'
  | 'series'
  | 'any'

/**
 * Public metadata for one drawer. This is the stable, serializable part of the
 * catalog: a drawer's `draw` function is only ever looked up by name.
 */
export interface FeatureChartDrawerMeta {
  name: string
  displayName: string
  /** One sentence: what it draws and which data shape it consumes. */
  description: string
  dataShape: FeatureChartDrawerDataShape
  /** Preferred chart size in px, reused by the maximize dialog. */
  defaultSize?: { width: number; height: number }
  /**
   * Reserved for WP2: documented shape of per-drawer options. Not read by the
   * renderers yet; drawer functions still receive the raw renderer config.
   */
  optionsSchema?: unknown
}

export interface DrawerProps {
  ctx: CanvasRenderingContext2D
  width: number
  height: number
  data: unknown
  description?: string
  name: string
  region: Region
  bpPerPx: number
  feature: Feature
  config: AnyConfigurationModel
  theme: ThemeOptions
  /**
   * Colors resolved from the renderer `colorScheme` slot for the active theme.
   * Drawers fall back to the default scheme when omitted (e.g. direct calls
   * from tests or third-party code).
   */
  colorScheme?: FeatureChartColorScheme
  /**
   * True when the drawer is rendering inside the maximize detail dialog,
   * where more space is available for axes, labels, etc.
   */
  isMaximize?: boolean
}

export type DrawerFunction = (props: DrawerProps) => void | Promise<void>
