import { useEffect, useMemo, useRef, useState } from 'react'

import { readConfObject } from '@jbrowse/core/configuration'
import { observer } from 'mobx-react'

import { SPEC_DRAWER_NAME } from '../../FeatureChartDrawer/chartSpec.ts'
import {
  type FeatureChartColorScheme,
  resolveColorScheme,
} from '../../FeatureChartDrawer/colorSchemes.ts'
import { resolveFeatureChartRenderSettings } from '../../renderSettings.ts'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature, Region } from '@jbrowse/core/util'
import type { BaseLinearDisplayModel } from '@jbrowse/plugin-linear-genome-view'
import type { ThemeOptions } from '@mui/material'
import type {
  Config as PlotlyConfig,
  Data as PlotlyData,
  Layout as PlotlyLayout,
  PlotlyModule,
} from 'plotly.js-dist-min'

function computeChartX(
  feature: Feature,
  region: Region,
  bpPerPx: number,
  chartWidth: number,
  align: 'left' | 'right' | 'center',
): number {
  const start = feature.get('start')
  const end = feature.get('end')

  switch (align) {
    case 'left':
      return (start - region.start) / bpPerPx
    case 'right':
      return (end - region.start) / bpPerPx - chartWidth
    case 'center': {
      const center = (start + end) / 2
      return (center - region.start) / bpPerPx - chartWidth / 2
    }
  }
}

function checkShouldShowWarning(
  items: { x: number }[],
  chartWidth: number,
  maxChartsPerView: number,
  minChartSpacingPx: number,
): boolean {
  if (items.length === 0) {
    return false
  }
  if (items.length > maxChartsPerView) {
    return true
  }
  if (items.length <= 1) {
    return false
  }

  const sorted = [...items].sort((a, b) => a.x - b.x)
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!
    const curr = sorted[i]!
    if (curr.x - (prev.x + chartWidth) < minChartSpacingPx) {
      return true
    }
  }
  return false
}

type TraceWithColor = PlotlyData & {
  marker?: { color?: unknown }
  line?: { color?: unknown }
}

function buildTraces(
  plotType: string,
  data: unknown,
  name: string,
  colorScheme: FeatureChartColorScheme,
): PlotlyData[] {
  // If data is already an array of Plotly traces, use it directly, filling in
  // palette colors only for traces that did not specify one.
  if (Array.isArray(data)) {
    return (data as TraceWithColor[]).map((trace, i) => ({
      ...trace,
      ...(trace.marker?.color || trace.line?.color
        ? {}
        : { marker: { color: pickColor(colorScheme, i) } }),
    }))
  }

  // If data looks like { x: number[], y: number[] }, use it for scatter/line
  if (
    data &&
    typeof data === 'object' &&
    'x' in data &&
    'y' in data &&
    Array.isArray((data as { x: unknown }).x) &&
    Array.isArray((data as { y: unknown }).y)
  ) {
    return [
      {
        type: plotType === 'line' ? 'scatter' : plotType,
        mode: plotType === 'line' ? 'lines' : 'markers',
        x: (data as { x: number[] }).x,
        y: (data as { y: number[] }).y,
        name,
        marker: { color: pickColor(colorScheme, 0) },
        line: { color: pickColor(colorScheme, 0) },
      },
    ]
  }

  // Otherwise, treat data as { category: number[] | number } for box/violin/bar
  const entries = data && typeof data === 'object' ? Object.entries(data) : []
  if (entries.length === 0) {
    return []
  }

  const firstValue = entries[0]![1]

  // Bar chart: values are single numbers
  if (!Array.isArray(firstValue)) {
    return [
      {
        type: 'bar',
        x: entries.map(([k]) => k),
        y: entries.map(([, v]) => Number(v)),
        name,
        marker: { color: pickColor(colorScheme, 0) },
      },
    ]
  }

  // Box or violin: values are arrays of numbers
  if (plotType === 'box') {
    return entries.map(([category, values], i) => ({
      type: 'box' as const,
      name: category,
      y: values as number[],
      boxpoints: false,
      marker: { color: pickColor(colorScheme, i) },
      line: { color: pickColor(colorScheme, i) },
    }))
  }

  if (plotType === 'violin') {
    return entries.map(([category, values], i) => ({
      type: 'violin' as const,
      name: category,
      y: values as number[],
      points: false,
      marker: { color: pickColor(colorScheme, i) },
      line: { color: pickColor(colorScheme, i) },
    }))
  }

  // Default to bar with mean values
  return [
    {
      type: 'bar',
      x: entries.map(([k]) => k),
      y: entries.map(([, v]) =>
        Array.isArray(v)
          ? (v as number[]).reduce((a, b) => a + b, 0) / v.length
          : Number(v),
      ),
      name,
      marker: { color: pickColor(colorScheme, 0) },
    },
  ]
}

function pickColor(colorScheme: FeatureChartColorScheme, index: number) {
  return colorScheme.colors[index % colorScheme.colors.length]!
}

const FeatureChartPlotlyRendering = observer(
  function FeatureChartPlotlyRendering(props: {
    features: Map<string, Feature>
    regions: Region[]
    bpPerPx: number
    width: number
    height: number
    blockKey: string
    displayModel: BaseLinearDisplayModel
    config: AnyConfigurationModel
    theme?: ThemeOptions
  }) {
    const {
      features,
      regions,
      bpPerPx,
      width,
      height,
      displayModel,
      config,
      theme,
    } = props
    const region = regions[0]!
    const containerRef = useRef<HTMLDivElement>(null)
    const [plotlyModule, setPlotlyModule] = useState<PlotlyModule | null>(null)

    // Geometry and colors come from this renderer's own config, not from
    // fields copied into the render props by the display.
    const settings = resolveFeatureChartRenderSettings(config)
    const {
      chartHeight,
      chartWidth,
      align,
      maxChartsPerView,
      minChartSpacingPx,
    } = settings
    const themeMode = theme?.palette?.mode
    const colorScheme = useMemo(
      () => resolveColorScheme(theme, settings.colorScheme),
      // The resolved scheme only depends on the palette name and theme mode.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [themeMode, settings.colorScheme],
    )
    const plotType =
      (readConfObject(config, 'plotType') as string | undefined) ?? 'box'

    useEffect(() => {
      let cancelled = false
      import('plotly.js-dist-min')
        .then(mod => {
          if (!cancelled) {
            setPlotlyModule(mod.default)
          }
        })
        .catch((error: unknown) => {
          console.error('Failed to load Plotly', error)
        })
      return () => {
        cancelled = true
      }
    }, [])

    const chartItems = Array.from(features.values())
      .map(feature => ({
        feature,
        x: computeChartX(feature, region, bpPerPx, chartWidth, align),
      }))
      .sort((a, b) => a.x - b.x)

    const showWarning = checkShouldShowWarning(
      chartItems,
      chartWidth,
      maxChartsPerView,
      minChartSpacingPx,
    )

    function getFeatureUnderMouse(eventClientX: number) {
      let offset = 0
      if (containerRef.current) {
        offset = containerRef.current.getBoundingClientRect().left
      }
      const offsetX = eventClientX - offset
      const px = region.reversed ? width - offsetX : offsetX
      const clientBp = region.start + bpPerPx * px

      let featureUnderMouse: Feature | undefined
      for (const { feature } of chartItems) {
        if (
          clientBp <= feature.get('end') &&
          clientBp >= feature.get('start')
        ) {
          featureUnderMouse = feature
          break
        }
      }
      return featureUnderMouse
    }

    return (
      <div
        ref={containerRef}
        data-testid="feature-chart-plotly-rendering-test"
        onMouseMove={e => {
          displayModel.setFeatureIdUnderMouse(
            getFeatureUnderMouse(e.clientX)?.id(),
          )
        }}
        onMouseLeave={() => {
          displayModel.setFeatureIdUnderMouse(undefined)
        }}
        style={{
          position: 'relative',
          height,
          width,
          overflow: 'hidden',
        }}
      >
        {settings.drawer === SPEC_DRAWER_NAME ? (
          // `spec` is a canvas-only contract (canvas painters + worker path). Saying
          // so here is the whole point of the WP3 decision: no silent blank chart.
          <div
            data-testid="feature-chart-plotly-spec-unsupported"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              backgroundColor: '#fff9c4',
              color: '#856404',
              border: '1px solid #f9a825',
              fontSize: 12,
              padding: 8,
              textAlign: 'center',
            }}
          >
            The Plotly renderer does not support chart specs yet — use
            FeatureChartRenderer for drawer: "spec".
          </div>
        ) : showWarning ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              backgroundColor: '#fff9c4',
              color: '#856404',
              border: '1px solid #f9a825',
              fontSize: 12,
              padding: 8,
              textAlign: 'center',
            }}
          >
            Too many charts — zoom in to view individual charts
          </div>
        ) : (
          chartItems.map(({ feature, x }) => (
            <Chart
              key={feature.id()}
              feature={feature}
              plotType={plotType}
              chartHeight={chartHeight}
              chartWidth={chartWidth}
              x={x}
              plotlyModule={plotlyModule}
              colorScheme={colorScheme}
            />
          ))
        )}
      </div>
    )
  },
)

function Chart({
  feature,
  plotType,
  chartHeight,
  chartWidth,
  x,
  plotlyModule,
  colorScheme,
}: {
  feature: Feature
  plotType: string
  chartHeight: number
  chartWidth: number
  x: number
  plotlyModule: PlotlyModule | null
  colorScheme: FeatureChartColorScheme
}) {
  const divRef = useRef<HTMLDivElement>(null)
  const contextData = feature.get('contextData') as
    | {
        data: unknown
        description?: string
        name: string
      }
    | undefined

  const traces = buildTraces(
    plotType,
    contextData?.data,
    contextData?.name ??
      (feature.get('name') as string | undefined) ??
      feature.id(),
    colorScheme,
  )

  useEffect(() => {
    const node = divRef.current
    if (!node || !plotlyModule || traces.length === 0) {
      return
    }

    const layout: PlotlyLayout = {
      width: chartWidth,
      height: chartHeight,
      margin: { l: 30, r: 10, t: 20, b: 30 },
      showlegend: false,
      colorway: colorScheme.colors,
      font: { size: 8, color: colorScheme.text },
      xaxis: {
        tickfont: { size: 8 },
        automargin: true,
        gridcolor: colorScheme.grid,
        linecolor: colorScheme.axis,
        zerolinecolor: colorScheme.grid,
      },
      yaxis: {
        tickfont: { size: 8 },
        automargin: true,
        gridcolor: colorScheme.grid,
        linecolor: colorScheme.axis,
        zerolinecolor: colorScheme.grid,
      },
      paper_bgcolor: colorScheme.background,
      plot_bgcolor: colorScheme.background,
    }

    const plotlyConfig: PlotlyConfig = {
      displayModeBar: false,
      staticPlot: false,
    }

    plotlyModule
      .newPlot(node, traces, layout, plotlyConfig)
      .catch((error: unknown) => {
        console.error('Plotly render error', error)
      })

    return () => {
      plotlyModule.purge(node).catch(() => {
        // ignore purge errors
      })
    }
  }, [plotlyModule, traces, chartWidth, chartHeight, colorScheme])

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: 0,
        width: chartWidth,
        height: chartHeight,
      }}
    >
      <div ref={divRef} style={{ width: chartWidth, height: chartHeight }} />
    </div>
  )
}

export default FeatureChartPlotlyRendering
