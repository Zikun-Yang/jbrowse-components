import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { renderToAbstractCanvas } from '@jbrowse/core/util'
import { rpcResult } from '@jbrowse/core/util/librpc'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import {
  type FeatureChartColorScheme,
  resolveColorScheme,
} from '../FeatureChartDrawer/colorSchemes.ts'
import {
  describeFeatureChartDrawerError,
  formatFeatureChartDrawerError,
} from '../FeatureChartDrawer/drawerErrors.ts'
import { warnUnknownDrawerOptions } from '../FeatureChartDrawer/drawerOptions.ts'
import {
  type FeatureChartDrawerError,
  isFeatureChartDrawerResolutionError,
  resolveFeatureChartDrawer,
} from '../FeatureChartDrawer/drawerRegistry.ts'
import { computeChartX } from '../chartGeometry.ts'
import { resolveFeatureChartRenderSettings } from '../renderSettings.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { RenderArgsDeserialized } from '@jbrowse/core/pluggableElementTypes/renderers/FeatureRendererType'
import type { Feature } from '@jbrowse/core/util'
import type { RpcResult } from '@jbrowse/core/util/librpc'

export interface ChartRenderArgs extends RenderArgsDeserialized {
  bpPerPx: number
  /**
   * The renderer's own config. Every chart setting is read from here (see
   * `renderSettings.ts`), so the display no longer copies slots into the
   * render props.
   */
  config: AnyConfigurationModel
}

/** Shape of `rpcResult().value`; `rpcResult` itself is typed as unknown. */
export interface FeatureChartRenderResults {
  features: unknown[]
  height: number
  width: number
  imageData?: unknown
  /** Set when the configured drawer name did not resolve. */
  drawerError?: string
  [key: string]: unknown
}

export type FeatureChartRenderReturn = RpcResult & {
  value: FeatureChartRenderResults
}

interface ChartItem {
  feature: Feature
  x: number
}

export async function renderFeatureChart(
  renderProps: ChartRenderArgs,
  pluginManager: PluginManager,
) {
  const { sessionId, adapterConfig, regions, bpPerPx, theme, config } =
    renderProps

  const settings = resolveFeatureChartRenderSettings(config)
  const {
    chartHeight,
    chartWidth,
    align,
    maxChartsPerView,
    minChartSpacingPx,
    drawerOptions,
  } = settings
  const colorScheme = resolveColorScheme(theme as any, settings.colorScheme)

  const region = regions[0]!
  const width = Math.max(1, (region.end - region.start) / bpPerPx)

  const { dataAdapter } = await getAdapter(
    pluginManager,
    sessionId,
    adapterConfig,
  )

  const features = await firstValueFrom(
    (dataAdapter as BaseFeatureDataAdapter)
      .getFeatures(region, renderProps)
      .pipe(toArray()),
  )

  // Never throw for a bad drawer name: a worker-level throw marks the whole
  // track as failed. Draw a readable placeholder in place of the charts.
  // The plugin manager is what makes plugin-contributed drawers visible here:
  // in the RPC worker this is the worker's own PluginManager, which installed
  // the same runtime plugins as the main thread.
  const drawerResolution = resolveFeatureChartDrawer(
    settings.drawer,
    pluginManager,
  )
  const drawerError = isFeatureChartDrawerResolutionError(drawerResolution)
    ? drawerResolution
    : undefined
  // Captured outside the canvas callback: the narrowed union is not preserved
  // inside the closure.
  const drawer = isFeatureChartDrawerResolutionError(drawerResolution)
    ? undefined
    : drawerResolution.drawer
  if (isFeatureChartDrawerResolutionError(drawerResolution)) {
    console.warn(
      `[feature-chart] ${formatFeatureChartDrawerError(drawerResolution)}`,
    )
  } else {
    // `drawerOptions` is not validated, so this is the only signal that a key
    // is misspelled or belongs to a different drawer. Development builds only.
    warnUnknownDrawerOptions(drawerResolution.meta, drawerOptions)
  }

  const chartItems = features
    .map(feature => ({
      feature,
      x: computeChartX(feature, { region, bpPerPx, chartWidth, align }),
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
      if (drawerError) {
        drawDrawerErrorPlaceholder(
          ctx,
          width,
          chartHeight,
          drawerError,
          colorScheme,
        )
        return
      }
      if (!drawer) {
        return
      }
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
          colorScheme,
          options: drawerOptions,
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
      // Surfaced so the UI (or an agent) can explain the empty charts without
      // reading the worker console.
      ...(drawerError
        ? { drawerError: formatFeatureChartDrawerError(drawerError) }
        : {}),
    },
    imageData ? [imageData] : [],
  ) as FeatureChartRenderReturn
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

/**
 * Readable replacement for the charts when the configured drawer is missing.
 * Kept deliberately simple: `Error`-free, no throwing, works in worker canvas.
 */
export function drawDrawerErrorPlaceholder(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  drawerError: FeatureChartDrawerError,
  colorScheme: FeatureChartColorScheme,
) {
  const { title, hint, available } =
    describeFeatureChartDrawerError(drawerError)

  ctx.fillStyle = colorScheme.background
  ctx.fillRect(0, 0, width, height)

  ctx.strokeStyle = '#f9a825'
  ctx.lineWidth = 1
  ctx.strokeRect(0.5, 0.5, Math.max(0, width - 1), Math.max(0, height - 1))

  ctx.fillStyle = colorScheme.text
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  const titleFont = `600 ${Math.max(9, Math.min(13, height * 0.07))}px sans-serif`
  const bodyFont = `${Math.max(8, Math.min(11, height * 0.055))}px sans-serif`

  ctx.font = titleFont
  const titleLines = wrapText(ctx, title, width - 16)
  ctx.font = bodyFont
  // The hint line is what tells a user this is a *missing plugin* rather than a
  // typo, so it is drawn before the available-names list.
  const bodyLines = [
    ...(hint === undefined ? [] : wrapText(ctx, hint, width - 16)),
    ...wrapText(ctx, available, width - 16),
  ]

  const titleLineHeight = Math.max(11, Math.min(16, height * 0.085))
  const bodyLineHeight = Math.max(10, Math.min(14, height * 0.07))
  const totalHeight =
    titleLines.length * titleLineHeight + bodyLines.length * bodyLineHeight
  let y = Math.max(4, (height - totalHeight) / 2) + titleLineHeight / 2

  ctx.font = titleFont
  for (const line of titleLines) {
    ctx.fillText(line, width / 2, y)
    y += titleLineHeight
  }

  ctx.font = bodyFont
  ctx.fillStyle = colorScheme.muted
  for (const line of bodyLines) {
    ctx.fillText(line, width / 2, y)
    y += bodyLineHeight
  }
}

/** Break `text` into lines that fit `maxWidth`, at most 5 lines. */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (current && ctx.measureText(candidate).width > maxWidth) {
      lines.push(current)
      current = word
    } else {
      current = candidate
    }
  }
  if (current) {
    lines.push(current)
  }

  const maxLines = 5
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines)
    kept[maxLines - 1] =
      `${kept[maxLines - 1]!.slice(0, Math.max(0, kept[maxLines - 1]!.length - 1))}…`
    return kept
  }
  return lines
}

export { computeChartX } from '../chartGeometry.ts'
