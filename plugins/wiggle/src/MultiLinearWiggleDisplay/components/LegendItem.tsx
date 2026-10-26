import RectBg from './RectBg.tsx'

import type { MinimalModel } from './types.ts'
import type { Source } from '../../util.ts'

const LegendItem = function ({
  source,
  idx,
  rowHeight,
  labelWidth,
  xOffset,
  model,
}: {
  source: Source
  idx: number
  rowHeight: number
  labelWidth: number
  xOffset: number
  model: MinimalModel
}) {
  const boxHeight = Math.min(20, rowHeight)
  const { needsCustomLegend, needsFullHeightScalebar, renderColorBoxes } = model
  const colorBoxWidth = renderColorBoxes ? 15 : 0
  const legendWidth = labelWidth + colorBoxWidth + 5
  return (
    <>
      {needsFullHeightScalebar ? null : (
        <RectBg
          y={idx * rowHeight + 1}
          x={xOffset}
          width={legendWidth}
          height={boxHeight}
        />
      )}
      {source.color ? (
        <RectBg
          y={idx * rowHeight + 1}
          x={xOffset}
          width={colorBoxWidth}
          height={needsCustomLegend ? rowHeight : boxHeight}
          color={source.color}
        />
      ) : null}
    </>
  )
}

export default LegendItem
