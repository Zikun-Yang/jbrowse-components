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
  const { renderColorBoxes } = model
  const svgFontSize = Math.min(rowHeight, 12)
  const canDisplayLabel = rowHeight >= 6
  const colorBoxWidth = renderColorBoxes ? 15 : 0

  return canDisplayLabel ? (
    <text
      y={idx * rowHeight + svgFontSize}
      x={xOffset + colorBoxWidth + 2}
      fontSize={svgFontSize}
      {...textFillProps}
    >
      {source.name}
    </text>
  ) : null
}

export default LegendItemText
