import { useMemo } from 'react'

import { getFillProps } from '@jbrowse/core/util'
import { useTheme } from '@mui/material'
import { observer } from 'mobx-react'

import LegendItem from './LegendItem.tsx'
import LegendItemText from './LegendItemText.tsx'

import type { MinimalModel } from './types.ts'

const ColorLegend = observer(function ColorLegend({
  model,
  rowHeight,
  exportSVG,
  xOffset,
}: {
  model: MinimalModel
  rowHeight: number
  exportSVG?: boolean
  /**
   * x of the whole legend block, in the coordinate system of the display. the
   * callers that also draw a y-scale bar pass its position plus the room its
   * tick labels need, so that the labels follow Settings -> Display -> Y-axis
   * left padding instead of a hardcoded x
   */
  xOffset?: number
}) {
  const { graphType, rowHeightTooSmallForScalebar, sources } = model
  // default when the caller has no scale bar to align with: 10px in an SVG
  // export (the exporter draws the track content from its left edge) and to
  // the right of the y-scale bar otherwise
  const offset =
    xOffset ??
    (exportSVG ? 10 : graphType && !rowHeightTooSmallForScalebar ? 50 : 0)
  const theme = useTheme()

  const textFillProps = useMemo(
    () => getFillProps(theme.palette.text.primary),
    [theme.palette.text.primary],
  )

  return sources ? (
    <>
      {/* No background rectangle behind the labels: it hid the track data and
          was removed on request. LegendItemText keeps the names readable over
          the data with a thin outline instead. */}
      {sources.map((source, idx) => (
        <LegendItem
          key={`${source.name}-${idx}`}
          source={source}
          idx={idx}
          model={model}
          rowHeight={rowHeight}
          xOffset={offset}
        />
      ))}
      {/* Then render all text elements on top */}
      {sources.map((source, idx) => (
        <LegendItemText
          key={`${source.name}-text-${idx}`}
          source={source}
          idx={idx}
          model={model}
          rowHeight={rowHeight}
          xOffset={offset}
          textFillProps={textFillProps}
        />
      ))}
    </>
  ) : null
})

export default ColorLegend
