interface AxesOverlayProps {
  width: number
  height: number
  embedding?: string
}

function getAxisLabels(embedding?: string): [string, string] {
  const name = (embedding ?? 'embedding').toLowerCase()
  const base = embedding?.replace(/^X_/, '') ?? 'embedding'
  if (name.includes('umap')) return ['UMAP 1', 'UMAP 2']
  if (name.includes('pca')) return ['PCA 1', 'PCA 2']
  if (name.includes('tsne')) return ['t-SNE 1', 't-SNE 2']
  return [`${base} 1`, `${base} 2`]
}

export default function AxesOverlay({
  width,
  height,
  embedding,
}: AxesOverlayProps) {
  const padding = { left: 24, bottom: 24 }
  const strokeWidth = 2
  const axisLength = Math.min(50, width / 7, height / 7)
  const arrowSize = strokeWidth * 2.5

  const xStart = padding.left
  const yStart = height - padding.bottom
  const xEnd = xStart + axisLength
  const yEnd = yStart - axisLength

  const [xLabel, yLabel] = getAxisLabels(embedding)

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
      <defs>
        <marker
          id="x-axis-arrow"
          markerWidth={arrowSize}
          markerHeight={arrowSize}
          refX={arrowSize - 1}
          refY={arrowSize / 2}
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path
            d={`M 0 0 L ${arrowSize} ${arrowSize / 2} L 0 ${arrowSize} Z`}
            fill="black"
          />
        </marker>
        <marker
          id="y-axis-arrow"
          markerWidth={arrowSize}
          markerHeight={arrowSize}
          refX={arrowSize - 1}
          refY={arrowSize / 2}
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path
            d={`M 0 0 L ${arrowSize} ${arrowSize / 2} L 0 ${arrowSize} Z`}
            fill="black"
          />
        </marker>
      </defs>

      <line
        x1={xStart}
        y1={yStart}
        x2={xEnd}
        y2={yStart}
        stroke="black"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        markerEnd="url(#x-axis-arrow)"
      />
      <line
        x1={xStart}
        y1={yStart}
        x2={xStart}
        y2={yEnd}
        stroke="black"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        markerEnd="url(#y-axis-arrow)"
      />

      <text
        x={(xStart + xEnd) / 2}
        y={yStart + 12}
        fontSize={12}
        fill="black"
        textAnchor="middle"
        dominantBaseline="hanging"
      >
        {xLabel}
      </text>
      <text
        x={xStart - 12}
        y={(yStart + yEnd) / 2}
        fontSize={12}
        fill="black"
        textAnchor="middle"
        dominantBaseline="middle"
        transform={`rotate(-90, ${xStart - 12}, ${(yStart + yEnd) / 2})`}
      >
        {yLabel}
      </text>
    </svg>
  )
}
