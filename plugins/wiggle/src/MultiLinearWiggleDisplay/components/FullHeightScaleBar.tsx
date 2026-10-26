import { getContainingView } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import ColorLegend from './ColorLegend.tsx'
import { getOffset } from './util.ts'
import YScaleBar from '../../shared/YScaleBar.tsx'

import type { WiggleDisplayModel } from '../model.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const FullHeightScaleBar = observer(function FullHeightScaleBar({
  model,
  orientation,
  exportSVG,
}: {
  model: WiggleDisplayModel
  orientation?: string
  exportSVG?: boolean
}) {
  const { labelWidth } = model
  const { width: viewWidth } = getContainingView(model) as LinearGenomeViewModel
  return (
    <>
      {/* the y-scale bar sits at the global y-axis left padding (Settings ->
          Display -> Y-axis left padding), on screen and in an SVG export */}
      <g transform={`translate(${getOffset(model)},0)`}>
        <YScaleBar model={model} orientation={orientation} />
      </g>
      <g transform={`translate(${viewWidth - labelWidth - 100},0)`}>
        <ColorLegend exportSVG={exportSVG} model={model} rowHeight={12} />
      </g>
    </>
  )
})

export default FullHeightScaleBar
