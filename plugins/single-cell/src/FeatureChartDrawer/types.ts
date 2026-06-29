import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'
import type { Region } from '@jbrowse/core/util/types'
import type { ThemeOptions } from '@mui/material'

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
   * True when the drawer is rendering inside the maximize detail dialog,
   * where more space is available for axes, labels, etc.
   */
  isMaximize?: boolean
}

export type DrawerFunction = (props: DrawerProps) => void | Promise<void>
