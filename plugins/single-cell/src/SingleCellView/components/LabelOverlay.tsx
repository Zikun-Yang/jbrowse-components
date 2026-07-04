import { useMemo } from 'react'
import { observer } from 'mobx-react'

import { normalizedToScreen } from './embeddingUtils.ts'

import type { SingleCellViewModel } from '../model.ts'

interface LabelOverlayProps {
  model: SingleCellViewModel
  width: number
  height: number
}

interface LabelInfo {
  text: string
  x: number
  y: number
}

const LabelOverlay = observer(function LabelOverlay({
  model,
  width,
  height,
}: LabelOverlayProps) {
  const { data, colorByObsColumn, showLabels, embeddingBounds, cameraView } =
    model

  const labels = useMemo(() => {
    if (
      !showLabels ||
      !data?.embeddingData ||
      !embeddingBounds ||
      !colorByObsColumn
    ) {
      return []
    }

    const col = data.metadata[colorByObsColumn]
    if (col?.type !== 'categorical') {
      return []
    }

    const colMap = data.labelToIndices.get(colorByObsColumn)
    if (!colMap) return []

    const { embeddingData } = data
    const { minX, maxX, minY, maxY } = embeddingBounds
    const scaleX = maxX - minX || 1
    const scaleY = maxY - minY || 1

    const result: LabelInfo[] = []
    for (const [label, indices] of colMap.entries()) {
      if (indices.size === 0) continue
      let sumX = 0
      let sumY = 0
      for (const idx of indices) {
        sumX += (embeddingData[idx * 2]! - minX) / scaleX
        sumY += (embeddingData[idx * 2 + 1]! - minY) / scaleY
      }
      const nx = sumX / indices.size
      const ny = sumY / indices.size
      const [sx, sy] = normalizedToScreen(nx, ny, cameraView, width, height)
      result.push({ text: label, x: sx, y: sy })
    }
    return result
  }, [
    data,
    colorByObsColumn,
    showLabels,
    embeddingBounds,
    cameraView,
    width,
    height,
  ])

  if (labels.length === 0) return null

  return (
    <svg
      width={width}
      height={height}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none',
      }}
    >
      {labels.map(({ text, x, y }) => (
        <g key={text}>
          <text
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={12}
            fontWeight={700}
            fill="black"
            stroke="white"
            strokeWidth={3}
            paintOrder="stroke"
            style={{ userSelect: 'none' }}
          >
            {text}
          </text>
        </g>
      ))}
    </svg>
  )
})

export default LabelOverlay
