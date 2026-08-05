import { getFillProps, getStrokeProps } from '@jbrowse/core/util'
import { alpha, useTheme } from '@mui/material'
import { observer } from 'mobx-react'

import { HEADER_BAR_HEIGHT } from '../consts.ts'

import type { LinearGenomeViewModel } from '../index.ts'
import type { Base1DViewModel } from '@jbrowse/core/util/Base1DViewModel'

const OverviewScalebarPolygon = observer(function OverviewScalebarPolygon({
  model,
  overview,
}: {
  model: LinearGenomeViewModel
  overview: Base1DViewModel
}) {
  const theme = useTheme()
  const polygonColor = theme.palette.tertiary.light

  const { interRegionPaddingWidth, offsetPx, dynamicBlocks } = model
  const { contentBlocks, totalWidthPxWithoutBorders } = dynamicBlocks

  if (!contentBlocks.length) {
    return null
  }

  const first = contentBlocks.at(0)!
  const last = contentBlocks.at(-1)!
  const topLeft =
    overview.bpToPx({
      refName: first.refName,
      coord: first.reversed ? first.end : first.start,
    }) || 0
  const topRight =
    overview.bpToPx({
      refName: last.refName,
      coord: last.reversed ? last.start : last.end,
    }) || 0

  const startPx = Math.max(0, -offsetPx)
  const endPx =
    startPx +
    totalWidthPxWithoutBorders +
    (contentBlocks.length * interRegionPaddingWidth) / 2

  const points = [
    [startPx, HEADER_BAR_HEIGHT],
    [endPx, HEADER_BAR_HEIGHT],
    [topRight, 0],
    [topLeft, 0],
  ]

  return (
    <polygon
      points={points.toString()}
      {...getFillProps(alpha(polygonColor, 0.3))}
      {...getStrokeProps(alpha(polygonColor, 0.8))}
    />
  )
})

export default OverviewScalebarPolygon
