import { useTheme } from '@mui/material'

import type { MinimalModel } from './types.ts'
import type { Source } from '../../util.ts'
import type { getFillProps } from '@jbrowse/core/util'

const LegendItemText = function ({
  source,
  idx,
  rowHeight,
  model,
  xOffset,
  textFillProps,
}: {
  source: Source
  idx: number
  rowHeight: number
  model: MinimalModel
  xOffset: number
  textFillProps: ReturnType<typeof getFillProps>
}) {
  const theme = useTheme()
  const { renderColorBoxes } = model
  const svgFontSize = Math.min(rowHeight, 12)
  const canDisplayLabel = rowHeight >= 6
  const colorBoxWidth = renderColorBoxes ? 15 : 0

  // the label used to sit on a white translucent rectangle, which was removed
  // because it covered the track data. a thin outline in the background color
  // keeps the name readable over the data instead, without painting a box
  return canDisplayLabel ? (
    <text
      y={idx * rowHeight + svgFontSize}
      x={xOffset + colorBoxWidth + 2}
      fontSize={svgFontSize}
      {...textFillProps}
      stroke={theme.palette.background.paper}
      strokeWidth={2}
      paintOrder="stroke"
    >
      {source.name}
    </text>
  ) : null
}

export default LegendItemText
