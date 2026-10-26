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
   * Documentation-only description of the per-drawer options a drawer reads
   * from `DrawerProps.options` (for example
   * `{ colorRamp: 'string', cellHeight: 'number' }`). The config editor does not
   * validate against it: it exists so users, docs and agents can discover what
   * a drawer accepts before writing a `drawerOptions` block.
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
   * Per-drawer options from the renderer `drawerOptions` slot. The renderers
   * always pass an object (empty when unset); it is optional here so tests and
   * third-party callers of a drawer keep working. Drawers read what they
   * understand with `options.x` and are expected to default/clamp their own
   * values, see the developer guide.
   */
  options?: Record<string, unknown>
  /**
   * True when the drawer is rendering inside the maximize detail dialog,
   * where more space is available for axes, labels, etc.
   */
  isMaximize?: boolean
}

export type DrawerFunction = (props: DrawerProps) => void | Promise<void>
