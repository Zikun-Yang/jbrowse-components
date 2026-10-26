import { observer } from 'mobx-react'

import ColorLegend from './ColorLegend.tsx'
import ScoreLegend from './ScoreLegend.tsx'
import {
  ROW_LABEL_OFFSET_FROM_SCALE_BAR,
  ROW_LABEL_OFFSET_IN_EXPORT,
  getOffset,
} from './util.ts'
import YScaleBar from '../../shared/YScaleBar.tsx'

import type { WiggleDisplayModel } from '../model.ts'

const IndividualScaleBars = observer(function IndividualScaleBars({
  model,
  orientation,
  exportSVG,
}: {
  model: WiggleDisplayModel
  orientation?: string
  exportSVG?: boolean
}) {
  const {
    sources,
    rowHeight,
    rowHeightTooSmallForScalebar,
    needsCustomLegend,
    ticks,
  } = model

  // every row draws its own y-scale bar, so every row has to use the global
  // y-axis left padding setting (Settings -> Display -> Y-axis left padding),
  // like the single-sample wiggle and the full-height multi-wiggle scale bar
  const scaleBarX = getOffset(model)
  // the row labels have to clear the tick labels of the scale bar. this is
  // only needed when the bars are drawn: small rows and the density renderer
  // use a score legend on the right instead
  const hasRowScaleBars = !rowHeightTooSmallForScalebar && !needsCustomLegend
  const labelX = exportSVG
    ? scaleBarX + ROW_LABEL_OFFSET_IN_EXPORT
    : hasRowScaleBars
      ? scaleBarX + ROW_LABEL_OFFSET_FROM_SCALE_BAR
      : 0

  return sources?.length ? (
    <>
      <ColorLegend
        exportSVG={exportSVG}
        model={model}
        rowHeight={rowHeight}
        xOffset={labelX}
      />

      {hasRowScaleBars ? (
        sources.map((_source, idx) => (
          <g
            data-testid={`multirow-y-scale-bar-${idx}`}
            transform={`translate(${scaleBarX} ${rowHeight * idx})`}
            key={`${JSON.stringify(ticks)}-${idx}`}
          >
            <YScaleBar model={model} orientation={orientation} />
          </g>
        ))
      ) : (
        <ScoreLegend model={model} />
      )}
    </>
  ) : null
})

export default IndividualScaleBars
