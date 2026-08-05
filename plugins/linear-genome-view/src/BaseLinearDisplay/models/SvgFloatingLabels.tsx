import {
  type FeatureLabelData,
  calculateFloatingLabelPosition,
} from '../components/util.ts'

interface Props {
  featureLabels: Map<string, FeatureLabelData>
  offsetPx: number
  viewWidth: number
}

export function SvgFloatingLabels({
  featureLabels,
  offsetPx,
  viewWidth,
}: Props) {
  const elements: React.ReactElement[] = []
  const fontSize = 11
  const leftLabelGap = 3

  for (const [
    key,
    { leftPx, topPx, totalFeatureHeight, floatingLabels, featureWidth },
  ] of featureLabels.entries()) {
    const featureVisualBottom = topPx + totalFeatureHeight
    const featureRightPx = leftPx + featureWidth
    const leftLabelCount = floatingLabels.reduce(
      (n, l) => n + (l.placement === 'left' ? 1 : 0),
      0,
    )
    let leftIndex = 0

    for (const [
      i,
      { text, relativeY, color, textWidth, isOverlay, placement },
    ] of floatingLabels.entries()) {
      const isLeft = placement === 'left'
      let x: number
      let y: number
      if (isLeft) {
        // x is the label's right edge - text is right-anchored so stacked
        // lines align exactly regardless of text-width estimation error
        const blockHeight = leftLabelCount * fontSize
        y =
          topPx + (totalFeatureHeight - blockHeight) / 2 + leftIndex * fontSize
        x = Math.round(leftPx - leftLabelGap - offsetPx)
        leftIndex++
      } else {
        y = featureVisualBottom + relativeY
        x = calculateFloatingLabelPosition(
          leftPx,
          featureRightPx,
          textWidth,
          offsetPx,
        )
      }

      const visibleLeft = isLeft ? x - textWidth : x
      const visibleRight = isLeft ? x : x + textWidth
      if (visibleRight < 0 || visibleLeft > viewWidth) {
        continue
      }

      elements.push(
        <g key={`${key}-${i}`} transform={`translate(${x}, ${y})`}>
          {isOverlay ? (
            <rect
              x={-1}
              y={0}
              width={textWidth + 2}
              height={fontSize + 1}
              fill="rgba(255, 255, 255, 0.8)"
            />
          ) : null}
          <text
            x={0}
            y={fontSize}
            fontSize={fontSize}
            fill={color}
            textAnchor={isLeft ? 'end' : undefined}
            style={{ pointerEvents: 'none' }}
          >
            {text}
          </text>
        </g>,
      )
    }
  }

  return <>{elements}</>
}
