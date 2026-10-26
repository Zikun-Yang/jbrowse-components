import RectBg from './RectBg.tsx'

import type { MinimalModel } from './types.ts'
import type { Source } from '../../util.ts'

/**
 * color swatch of one source of the legend. the label itself is drawn by
 * LegendItemText, and there used to be a white translucent rectangle behind
 * each label here, which was removed on request because it covered the track
 * data
 */
const LegendItem = function ({
  source,
  idx,
  rowHeight,
  xOffset,
  model,
}: {
  source: Source
  idx: number
  rowHeight: number
  xOffset: number
  model: MinimalModel
}) {
  const boxHeight = Math.min(20, rowHeight)
  const { needsCustomLegend, renderColorBoxes } = model
  // the multi-row line/xy renderers draw the color in the track itself, so
  // they don't need a swatch (and a zero width one is not drawn at all)
  const colorBoxWidth = renderColorBoxes ? 15 : 0
  return source.color && colorBoxWidth ? (
    <RectBg
      y={idx * rowHeight + 1}
      x={xOffset}
      width={colorBoxWidth}
      height={needsCustomLegend ? rowHeight : boxHeight}
      color={source.color}
    />
  ) : null
}

export default LegendItem
