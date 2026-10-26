import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { renderToAbstractCanvas } from '@jbrowse/core/util'
import { rpcResult } from '@jbrowse/core/util/librpc'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import {
  type ChartSpec,
  type ChartSpecError,
  SPEC_DRAWER_NAME,
  formatChartSpecError,
  normalizeValidatedSpec,
  validateChartSpec,
} from '../FeatureChartDrawer/chartSpec.ts'
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
import { drawPlaceholderPanel } from '../FeatureChartDrawer/placeholder.ts'
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
  /** Set when `drawer: "spec"` is configured with an invalid spec. */
  specError?: string
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

  // `drawer: "spec"` is validated once per render: a structural problem is the
  // same for every chart, so it gets one track-wide placeholder instead of 40.
  const isSpecDrawer = settings.drawer === SPEC_DRAWER_NAME
  const specStructuralErrors: ChartSpecError[] = isSpecDrawer
    ? validateChartSpec(settings.spec)
    : []
  const spec: ChartSpec | undefined =
    isSpecDrawer && specStructuralErrors.length === 0
      ? (settings.spec as ChartSpec)
      : undefined
  if (specStructuralErrors.length > 0) {
    console.warn(
      `[feature-chart] invalid chart spec: ${specStructuralErrors
        .map(error => formatChartSpecError(error))
        .join('; ')}`,
    )
  }

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
      if (specStructuralErrors.length > 0) {
        drawChartSpecErrorPlaceholder(
          ctx,
          width,
          chartHeight,
          specStructuralErrors,
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

        // Data-level spec problems are per chart: this one gets a placeholder,
        // the rest of the track keeps painting.
        const normalization = spec
          ? normalizeValidatedSpec(spec, contextData?.data)
          : undefined

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
          ...(normalization?.model === undefined
            ? normalization?.errors === undefined
              ? {}
              : { modelErrors: normalization.errors }
            : { model: normalization.model }),
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
      ...(specStructuralErrors.length > 0
        ? {
            specError: specStructuralErrors
              .map(error => formatChartSpecError(error))
              .join('; '),
          }
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
 * Kept as a thin wrapper over the shared panel so the drawer and spec
 * placeholders cannot drift apart visually.
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

  drawPlaceholderPanel(
    ctx,
    width,
    height,
    {
      title,
      // The hint line is what tells a user this is a *missing plugin* rather
      // than a typo, so it is drawn before the available-names list.
      body: [...(hint === undefined ? [] : [hint]), available],
    },
    colorScheme,
  )
}

/**
 * Track-wide replacement for `drawer: "spec"` with a structurally invalid spec.
 * Data-level problems are per chart and are drawn by the `spec` drawer itself.
 */
export function drawChartSpecErrorPlaceholder(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  errors: ChartSpecError[],
  colorScheme: FeatureChartColorScheme,
) {
  const [first, ...rest] = errors
  drawPlaceholderPanel(
    ctx,
    width,
    height,
    {
      title: 'Invalid chart spec',
      body: [
        ...(first ? [formatChartSpecError(first)] : []),
        ...(rest.length > 0
          ? [`(+${rest.length} more, see the maximize dialog)`]
          : []),
        'See plugins/feature-chart/SPEC.md',
      ],
    },
    colorScheme,
  )
}

export { computeChartX } from '../chartGeometry.ts'
