import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { renderToAbstractCanvas } from '@jbrowse/core/util'
import { rpcResult } from '@jbrowse/core/util/librpc'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import { getFeatureChartDrawer } from '../FeatureChartDrawer/drawerRegistry.ts'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, Region } from '@jbrowse/core/util'
import type { RenderArgsDeserialized } from '@jbrowse/core/pluggableElementTypes/renderers/FeatureRendererType'

export interface ChartRenderArgs extends RenderArgsDeserialized {
  bpPerPx: number
  chartHeight: number
  chartWidth: number
  align: 'left' | 'right' | 'center'
  maxChartsPerView: number
  minChartSpacingPx: number
  drawer: string
}

interface ChartItem {
  feature: Feature
  x: number
}

export async function renderFeatureChart(
  renderProps: ChartRenderArgs,
  pluginManager: PluginManager,
) {
  const {
    sessionId,
    adapterConfig,
    regions,
    bpPerPx,
    chartHeight,
    chartWidth,
    align,
    maxChartsPerView,
    minChartSpacingPx,
    drawer: drawerName,
    theme,
    config,
  } = renderProps

  const region = regions[0]!
  const width = Math.max(1, (region.end - region.start) / bpPerPx)

  const { dataAdapter } = await getAdapter(
    pluginManager,
    sessionId,
    adapterConfig as AnyConfigurationModel,
  )

  const features = await firstValueFrom(
    (dataAdapter as BaseFeatureDataAdapter)
      .getFeatures(region, renderProps)
      .pipe(toArray()),
  )

  const drawer = getFeatureChartDrawer(drawerName)
  if (!drawer) {
    throw new Error(`Unknown FeatureChart drawer: ${drawerName}`)
  }

  const chartItems = features
    .map(feature => ({
      feature,
      x: computeChartX(feature, region, bpPerPx, chartWidth, align),
    }))
    .sort((a, b) => a.x - b.x)

  const shouldShowWarning = checkShouldShowWarning(
    chartItems,
    chartWidth,
    maxChartsPerView,
    minChartSpacingPx,
  )

  const rest = await renderToAbstractCanvas(
    width,
    chartHeight,
    renderProps,
    async ctx => {
      if (shouldShowWarning) {
        drawWarning(ctx, width, chartHeight)
        return
      }

      for (const item of chartItems) {
        ctx.save()
        ctx.beginPath()
        ctx.rect(item.x, 0, chartWidth, chartHeight)
        ctx.clip()
        const contextData = item.feature.get('contextData') as
          | {
              data: unknown
              description?: string
              name: string
            }
          | undefined

        await drawer({
          ctx,
          width: chartWidth,
          height: chartHeight,
          data: contextData?.data,
          description: contextData?.description,
          name: contextData?.name ?? item.feature.get('name'),
          region,
          bpPerPx,
          feature: item.feature,
          config,
          theme: theme as any,
        })
        ctx.restore()
      }
    },
  )

  const imageData = (rest as { imageData?: ImageBitmap }).imageData

  return rpcResult(
    {
      ...rest,
      features: features.map(f => f.toJSON()),
      height: chartHeight,
      width,
    },
    imageData ? [imageData] : [],
  )
}

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
  items: ChartItem[],
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

function drawWarning(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
) {
  ctx.fillStyle = '#fff9c4'
  ctx.fillRect(0, 0, width, height)

  ctx.strokeStyle = '#f9a825'
  ctx.lineWidth = 1
  ctx.strokeRect(0, 0, width, height)

  ctx.fillStyle = '#856404'
  ctx.font = '12px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(
    'Too many charts — zoom in to view individual charts',
    width / 2,
    height / 2,
  )
}
