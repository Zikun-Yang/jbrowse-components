import { useEffect, useRef, useState } from 'react'

import { readConfObject } from '@jbrowse/core/configuration'
import { observer } from 'mobx-react'

import type { Feature, Region } from '@jbrowse/core/util'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { BaseLinearDisplayModel } from '@jbrowse/plugin-linear-genome-view'

type PlotlyModule = typeof import('plotly.js-dist-min').default
type PlotlyData = Partial<import('plotly.js-dist-min').Data>
type PlotlyLayout = Partial<import('plotly.js-dist-min').Layout>
type PlotlyConfig = Partial<import('plotly.js-dist-min').Config>
type PlotlyPlotType = import('plotly.js-dist-min').PlotType

function computeChartX(
  feature: Feature,
  region: Region,
  bpPerPx: number,
  chartWidth: number,
  align: 'left' | 'right' | 'center',
): number {
  const start = feature.get('start') as number
  const end = feature.get('end') as number

  switch (align) {
    case 'left':
      return (start - region.start) / bpPerPx
    case 'right':
      return (end - region.start) / bpPerPx - chartWidth
    case 'center':
    default: {
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

function buildTraces(
  plotType: string,
  data: unknown,
  name: string,
): PlotlyData[] {
  // If data is already an array of Plotly traces, use it directly
  if (Array.isArray(data)) {
    return data as PlotlyData[]
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
        type: plotType === 'line' ? 'scatter' : (plotType as PlotlyPlotType),
        mode: plotType === 'line' ? 'lines' : 'markers',
        x: (data as { x: number[] }).x,
        y: (data as { y: number[] }).y,
        name,
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
      },
    ]
  }

  // Box or violin: values are arrays of numbers
  if (plotType === 'box') {
    return entries.map(([category, values]) => ({
      type: 'box' as const,
      name: category,
      y: values as number[],
      boxpoints: false,
    }))
  }

  if (plotType === 'violin') {
    return entries.map(([category, values]) => ({
      type: 'violin' as const,
      name: category,
      y: values as number[],
      points: false,
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
    },
  ]
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
  }) {
    const { features, regions, bpPerPx, width, height, displayModel, config } =
      props
    const region = regions[0]!
    const containerRef = useRef<HTMLDivElement>(null)
    const [plotlyModule, setPlotlyModule] = useState<PlotlyModule | null>(null)

    const chartHeight = (readConfObject(config, 'chartHeight') as number) ?? 180
    const chartWidth = (readConfObject(config, 'chartWidth') as number) ?? 120
    const align =
      (readConfObject(config, 'align') as 'left' | 'right' | 'center') ??
      'center'
    const plotType = (readConfObject(config, 'plotType') as string) ?? 'box'
    const maxChartsPerView =
      (readConfObject(config, 'maxChartsPerView') as number) ?? 100
    const minChartSpacingPx =
      (readConfObject(config, 'minChartSpacingPx') as number) ?? 4

    useEffect(() => {
      let cancelled = false
      import('plotly.js-dist-min')
        .then(mod => {
          if (!cancelled) {
            setPlotlyModule(mod.default)
          }
        })
        .catch(error => {
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
        {showWarning ? (
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
}: {
  feature: Feature
  plotType: string
  chartHeight: number
  chartWidth: number
  x: number
  plotlyModule: PlotlyModule | null
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
    contextData?.name ?? (feature.get('name') as string) ?? feature.id(),
  )

  useEffect(() => {
    if (!divRef.current || !plotlyModule || traces.length === 0) {
      return
    }

    const layout: PlotlyLayout = {
      width: chartWidth,
      height: chartHeight,
      margin: { l: 30, r: 10, t: 20, b: 30 },
      showlegend: false,
      xaxis: { tickfont: { size: 8 }, automargin: true },
      yaxis: { tickfont: { size: 8 }, automargin: true },
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
    }

    const plotlyConfig: PlotlyConfig = {
      displayModeBar: false,
      staticPlot: false,
    }

    plotlyModule
      .newPlot(divRef.current, traces, layout, plotlyConfig)
      .catch((error: unknown) => {
        console.error('Plotly render error', error)
      })

    return () => {
      if (divRef.current && plotlyModule) {
        plotlyModule.purge(divRef.current).catch(() => {
          // ignore purge errors
        })
      }
    }
  }, [plotlyModule, traces, chartWidth, chartHeight])

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
