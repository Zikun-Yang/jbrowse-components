import { getSession, stripAlpha } from '@jbrowse/core/util'
import Base1DView from '@jbrowse/core/util/Base1DViewModel'
import { useTheme } from '@mui/material'

import SVGRuler from './SVGRuler.tsx'
import SVGScalebar from './SVGScalebar.tsx'
import Cytobands from '../components/Cytobands.tsx'
import OverviewScalebarPolygon from '../components/OverviewScalebarPolygon.tsx'
import { HEADER_OVERVIEW_BAR_HEIGHT } from '../consts.ts'

import type { LinearGenomeViewModel } from '../index.ts'

export default function SVGHeader({
  model,
  fontSize,
  cytobandHeight,
  rulerHeight,
}: {
  model: LinearGenomeViewModel
  rulerHeight: number
  fontSize: number
  cytobandHeight: number
}) {
  const { width, assemblyNames, showCytobands, displayedRegions } = model
  const { assemblyManager } = getSession(model)
  const assemblyName = assemblyNames.length > 1 ? '' : assemblyNames[0]!
  const theme = useTheme()
  const c = stripAlpha(theme.palette.text.primary)
  const overview = Base1DView.create({
    displayedRegions: JSON.parse(JSON.stringify(displayedRegions)),
    interRegionPaddingWidth: 0,
    minimumBlockWidth: model.minimumBlockWidth,
  })
  const visibleRegions = model.dynamicBlocks.contentBlocks
  if (!visibleRegions.length) {
    return null
  }

  overview.setVolatileWidth(width)
  overview.showAllRegions()
  const blocks = overview.dynamicBlocks.contentBlocks
  const first = visibleRegions.at(0)!
  const last = visibleRegions.at(-1)!
  const firstOverviewPx =
    overview.bpToPx({
      // eslint-disable-next-line @typescript-eslint/no-misused-spread
      ...first,
      coord: first.reversed ? first.end : first.start,
    }) || 0

  const lastOverviewPx =
    overview.bpToPx({
      // eslint-disable-next-line @typescript-eslint/no-misused-spread
      ...last,
      coord: last.reversed ? last.start : last.end,
    }) || 0
  const y = +showCytobands * cytobandHeight
  return (
    <g id="header">
      <text x={0} y={0} dominantBaseline="hanging" fontSize={fontSize} fill={c}>
        {assemblyName}
      </text>

      {showCytobands ? (
        <g transform={`translate(0 ${rulerHeight})`}>
          {blocks.map(block => (
            <Cytobands
              key={`${block.refName}-${block.start}-${block.end}`}
              overview={overview}
              assembly={assemblyManager.get(block.assemblyName)}
              block={block}
            />
          ))}
          <rect
            stroke="red"
            fill="rgb(255,0,0)"
            fillOpacity={0.1}
            width={Math.max(lastOverviewPx - firstOverviewPx, 0.5)}
            height={HEADER_OVERVIEW_BAR_HEIGHT - 1}
            x={firstOverviewPx}
            y={0.5}
          />
          <g transform={`translate(0,${HEADER_OVERVIEW_BAR_HEIGHT})`}>
            <OverviewScalebarPolygon overview={overview} model={model} />
          </g>
        </g>
      ) : null}

      <g transform={`translate(0 ${fontSize + y})`}>
        <SVGScalebar model={model} fontSize={fontSize} />
      </g>
      <g transform={`translate(0 ${rulerHeight + y})`}>
        <SVGRuler model={model} fontSize={fontSize} />
      </g>
    </g>
  )
}
