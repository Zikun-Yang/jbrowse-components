import { getFillProps, measureText } from '@jbrowse/core/util'
import { useTheme } from '@mui/material'
import { observer } from 'mobx-react'

// core
import { getCytobands } from './util.ts'
import { HEADER_OVERVIEW_BAR_HEIGHT } from '../consts.ts'

import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import type { Base1DViewModel } from '@jbrowse/core/util/Base1DViewModel'
import type { ContentBlock } from '@jbrowse/core/util/blockTypes'

function leftTriangle(x: number, _y: number, width: number, height: number) {
  return [
    [x, 0],
    [x + width, height / 2],
    [x, height],
  ].toString()
}

function rightTriangle(x: number, _y: number, width: number, height: number) {
  return [
    [x, height / 2],
    [x + width, 0],
    [x + width, height],
  ].toString()
}

const colorMap: Record<string, string> = {
  gneg: 'rgb(227,227,227)',
  gpos25: 'rgb(142,142,142)',
  gpos33: 'rgb(142,142,142)',
  gpos50: 'rgb(85,85,85)',
  gpos66: 'rgb(85,85,85)',
  gpos100: 'rgb(0,0,0)',
  gpos75: 'rgb(57,57,57)',
  gvar: 'rgb(0,0,0)',
  stalk: 'rgb(127,127,127)',
  acen: '#800',
}

const LABEL_FONT_SIZE = 10
const LABEL_PADDING = 4

const Cytobands = observer(function Cytobands({
  overview,
  block,
  assembly,
}: {
  overview: Base1DViewModel
  assembly?: Assembly
  block: ContentBlock
}) {
  const { offsetPx, reversed } = block
  const theme = useTheme()
  const cytobands = getCytobands(assembly, block.refName)

  const h = HEADER_OVERVIEW_BAR_HEIGHT
  const bands = cytobands.map(args => {
    const { refName, start, end } = args
    const s = overview.bpToPx({ refName, coord: start }) || 0
    const e = overview.bpToPx({ refName, coord: end }) || 0
    return {
      ...args,
      l: Math.min(s, e),
      r: Math.max(s, e),
      s,
    }
  })

  if (!bands.length) {
    return null
  }

  // black border rects around each arm, bounded by (but excluding) the acen
  // triangles
  const chromL = Math.min(...bands.map(b => b.l))
  const chromR = Math.max(...bands.map(b => b.r))
  const acenBands = bands.filter(b => b.type === 'acen')
  const borderRects: { x: number; w: number }[] = []
  if (acenBands.length) {
    const acenL = Math.min(...acenBands.map(b => b.l))
    const acenR = Math.max(...acenBands.map(b => b.r))
    if (acenL - chromL > 0) {
      borderRects.push({ x: chromL, w: acenL - chromL })
    }
    if (chromR - acenR > 0) {
      borderRects.push({ x: acenR, w: chromR - acenR })
    }
  } else {
    borderRects.push({ x: chromL, w: chromR - chromL })
  }

  let centromereSeen = false
  let curr = ''
  let idx = 0
  return (
    <g transform={`translate(-${offsetPx})`}>
      {bands.map(args => {
        const { name, type, l, r, s } = args
        const w = r - l
        const k = `${name}-${l}-${w}`
        if (type === 'n/a') {
          const match = name?.match(/^(\d+)([A-Za-z])/)
          const ret = match[1] + match[2]
          if (ret && ret !== curr) {
            curr = ret
            idx++
          }
        }
        const c =
          type === 'n/a'
            ? idx % 2
              ? 'black'
              : '#a77'
            : colorMap[type] || 'black'

        if (type === 'acen' && !centromereSeen) {
          centromereSeen = true // the next acen entry is drawn with different right triangle
          return (
            <polygon
              key={k}
              points={
                reversed
                  ? rightTriangle(s - w, 0, w, h)
                  : leftTriangle(s, 0, w, h)
              }
              {...getFillProps(c)}
            />
          )
        }
        if (type === 'acen') {
          return (
            <polygon
              key={k}
              points={
                reversed
                  ? leftTriangle(s - w, 0, w, h)
                  : rightTriangle(s, 0, w, h)
              }
              {...getFillProps(c)}
            />
          )
        }

        const showLabel =
          name && w >= measureText(name, LABEL_FONT_SIZE) + LABEL_PADDING
        return (
          <g key={k}>
            <rect x={l} y={0} width={w} height={h} {...getFillProps(c)} />
            {showLabel ? (
              <text
                x={l + w / 2}
                y={h / 2}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={LABEL_FONT_SIZE}
                fill={theme.palette.getContrastText(c)}
                pointerEvents="none"
              >
                {name}
              </text>
            ) : null}
          </g>
        )
      })}
      {borderRects.map(({ x, w }) => (
        <rect
          key={`border-${x}-${w}`}
          x={x + 0.5}
          y={0.5}
          width={Math.max(w - 1, 0)}
          height={h - 1}
          fill="none"
          stroke={theme.palette.text.primary}
          strokeWidth={1}
          pointerEvents="none"
        />
      ))}
    </g>
  )
})

export default Cytobands
