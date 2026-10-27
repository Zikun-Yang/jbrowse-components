import { useEffect, useRef, useState } from 'react'

import { PLOTLY_INLINE_CONFIG, loadPlotly } from '../plotlyLoader.ts'

import type { PlotlyExportHandle } from '../plotlyLoader.ts'
import type {
  Data as PlotlyData,
  Layout as PlotlyLayout,
  PlotlyModule,
} from 'plotly.js-dist-min'

/**
 * The Plotly element: one `newPlot`, one `purge`, and an optional handle the
 * maximize dialog uses for `toImage`. The loader and the handle type live in
 * `plotlyLoader.ts` so this module only exports a component.
 */
export default function PlotlyPlot({
  traces,
  layout,
  onPlotReady,
  testId = 'feature-chart-plotly-plot',
}: {
  traces: PlotlyData[]
  layout: PlotlyLayout
  onPlotReady?: (handle: PlotlyExportHandle | null) => void
  testId?: string
}) {
  const nodeRef = useRef<HTMLDivElement>(null)
  const [plotly, setPlotly] = useState<PlotlyModule | null>(null)

  useEffect(() => {
    let cancelled = false
    loadPlotly()
      .then(module => {
        if (!cancelled) {
          setPlotly(module)
        }
      })
      .catch((error: unknown) => {
        console.error('Failed to load Plotly', error)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const node = nodeRef.current
    if (!node || !plotly || traces.length === 0) {
      onPlotReady?.(null)
      return
    }
    let disposed = false
    plotly
      .newPlot(node, traces, layout, PLOTLY_INLINE_CONFIG)
      .then(() => {
        if (!disposed) {
          onPlotReady?.({ node, plotly })
        }
      })
      .catch((error: unknown) => {
        console.error('Plotly render error', error)
      })

    return () => {
      disposed = true
      onPlotReady?.(null)
      plotly.purge(node).catch(() => {
        // purge after unmount is best-effort; Plotly throws on a detached node
      })
    }
    // `traces`/`layout` are memoized by the callers on the model hash.
  }, [plotly, traces, layout, onPlotReady])

  return (
    <div
      ref={nodeRef}
      data-testid={testId}
      style={{ width: layout.width, height: layout.height }}
    />
  )
}
