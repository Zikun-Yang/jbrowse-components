import { useEffect, useRef, useState } from 'react'

import { PLOTLY_INLINE_CONFIG, loadPlotly } from '../plotlyLoader.ts'

import type { PlotlyExportHandle } from '../plotlyLoader.ts'
import type {
  Data as PlotlyData,
  Layout as PlotlyLayout,
  PlotlyModule,
} from 'plotly.js-dist-min'

/**
 * `Plotly.purge()` is best-effort teardown: in `plotly.js-dist-min` it returns
 * `undefined` (older builds) or a promise (newer ones), so calling `.catch` on
 * it throws `purge(...).catch is not a function` from inside the effect cleanup,
 * which React surfaces as a render error in the track. Accept both shapes and
 * never let teardown take the track down.
 */
function purgeQuietly(plotly: PlotlyModule, node: HTMLElement) {
  try {
    const result: unknown = plotly.purge(node)
    if (result && typeof (result as Promise<void>).catch === 'function') {
      void (result as Promise<void>).catch(() => {
        // purge after unmount is best-effort; Plotly throws on a detached node
      })
    }
  } catch {
    // purge after unmount is best-effort; Plotly throws on a detached node
  }
}

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
      purgeQuietly(plotly, node)
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
