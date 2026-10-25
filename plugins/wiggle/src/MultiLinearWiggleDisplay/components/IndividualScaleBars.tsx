import { observer } from 'mobx-react'

import ColorLegend from './ColorLegend.tsx'
import ScoreLegend from './ScoreLegend.tsx'
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
    hierarchy,
    showTree,
    treeAreaWidth,
  } = model

  // The cluster tree sidebar paints an opaque-ish background over the leftmost
  // treeAreaWidth pixels, so the row labels are shifted right of it to stay
  // visible. This is the only row label drawn for multi-row renders (see
  // WiggleDisplayComponent)
  const labelXOffset = hierarchy && showTree ? treeAreaWidth : 0

  return sources?.length ? (
    <>
      <g transform={`translate(${labelXOffset} 0)`}>
        <ColorLegend
          exportSVG={exportSVG}
          model={model}
          rowHeight={model.rowHeight}
        />
      </g>

      {rowHeightTooSmallForScalebar || needsCustomLegend ? (
        <ScoreLegend model={model} />
      ) : (
        sources.map((_source, idx) => (
          <g
            transform={`translate(0 ${rowHeight * idx})`}
            key={`${JSON.stringify(ticks)}-${idx}`}
          >
            <YScaleBar model={model} orientation={orientation} />
          </g>
        ))
      )}
    </>
  ) : null
})

export default IndividualScaleBars
