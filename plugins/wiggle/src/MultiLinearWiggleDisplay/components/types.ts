import type { Source } from '../types.ts'

export interface MinimalModel {
  graphType: boolean
  rowHeightTooSmallForScalebar: boolean
  sources: Source[] | undefined
  renderColorBoxes: boolean
  labelWidth: number
  needsCustomLegend: boolean
}
