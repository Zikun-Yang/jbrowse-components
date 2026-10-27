import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { renderToAbstractCanvas } from '@jbrowse/core/util'
import { rpcResult } from '@jbrowse/core/util/librpc'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import {
  type ChartSpecError,
  formatChartSpecError,
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
import { drawPlaceholderPanel } from '../FeatureChartDrawer/placeholder.ts'
import {
  TOO_MANY_CHARTS_MESSAGE,
  shouldShowChartWarning,
} from '../chartDensity.ts'
import { computeChartX } from '../chartGeometry.ts'
import {
  chartModelForData,
  resolveTrackChartSource,
} from '../chartModelSources.ts'
import {
  chartCacheKey,
  chartCacheSupported,
  chartCanvasBytes,
  colorSchemeHash,
  createChartCanvas,
  drawerSignature,
  getCachedChartCanvas,
  storeChartCanvas,
} from '../renderCache.ts'
import { resolveFeatureChartRenderSettings } from '../renderSettings.ts'

import type { FeatureChartDrawerError } from '../FeatureChartDrawer/drawerRegistry.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { RenderArgsDeserialized } from '@jbrowse/core/pluggableElementTypes/renderers/FeatureRendererType'
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

  // The drawer/spec half of the pipeline is resolved once per render (it does
  // not depend on the feature payload), and the model half runs per chart. Both
  // backends use `chartModelSources.ts`, which is what makes "canvas and Plotly
  // draw the same chart" a property of the code rather than of two agreeing
  // implementations.
  const source = resolveTrackChartSource({
    drawer: settings.drawer,
    spec: settings.spec,
    pluginManager,
  })
  const specStructuralErrors: ChartSpecError[] = source.specErrors ?? []
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
  const drawerError = source.drawerError
  if (drawerError) {
    console.warn(
      `[feature-chart] ${formatFeatureChartDrawerError(drawerError)}`,
    )
  } else if (source.meta) {
    // `drawerOptions` is not validated, so this is the only signal that a key
    // is misspelled or belongs to a different drawer. Development builds only.
    warnUnknownDrawerOptions(source.meta, drawerOptions)
  }
  const drawer = source.draw

  const chartItems = features
    .map(feature => ({
      feature,
      x: computeChartX(feature, { region, bpPerPx, chartWidth, align }),
    }))
    .sort((a, b) => a.x - b.x)

  const shouldShowWarning = shouldShowChartWarning(chartItems, {
    chartWidth,
    maxChartsPerView,
    minChartSpacingPx,
  })

  // Cache: config-level feature flag, and only when this runtime can allocate a
  // detached canvas. Everything that changes pixels is part of the key (see
  // `renderCache.ts`), so a hit cannot show a stale chart.
  const cacheEnabled = settings.renderCache && chartCacheSupported()
  // `highResolutionScaling` is what `renderToAbstractCanvas` used to scale the
  // target context, so it — not `devicePixelRatio` (absent in workers) — is the
  // scale a cached bitmap must be rendered at to stay crisp on HiDPI screens.
  const scaling = renderProps.highResolutionScaling
  const dpr =
    typeof scaling === 'number' && scaling > 0
      ? scaling
      : typeof devicePixelRatio === 'number'
        ? devicePixelRatio
        : 1
  const themeHash = colorSchemeHash(colorScheme)
  const signature = drawerSignature(settings.drawer, drawerOptions)

  const rest = await renderToAbstractCanvas(
    width,
    chartHeight,
    renderProps,
    async ctx => {
      // A context without `drawImage` (a test recorder, a minimal canvas
      // polyfill) cannot blit a cached chart, so it keeps the direct path.
      const canBlit = cacheEnabled && typeof ctx.drawImage === 'function'
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
        // the rest of the track keeps painting. For a built-in drawer this is
        // the payload → model step (the same function Plotly calls).
        const { model, modelErrors } = chartModelForData(
          source,
          contextData?.data,
        )

        const props = {
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
          ...(model === undefined ? {} : { model }),
          ...(modelErrors === undefined ? {} : { modelErrors }),
        }

        // Cached path: paint once into an offscreen canvas, reuse it while the
        // key holds (feature, model, size, dpr, theme, drawer options). Pan
        // frames then cost one `drawImage` per chart instead of a full repaint.
        if (canBlit && model) {
          const key = chartCacheKey({
            featureId: item.feature.id(),
            model,
            width: chartWidth,
            height: chartHeight,
            dpr,
            themeHash,
            drawerSignature: signature,
          })
          const cached = getCachedChartCanvas(key)
          if (cached) {
            ctx.drawImage(
              cached as unknown as CanvasImageSource,
              item.x,
              0,
              chartWidth,
              chartHeight,
            )
            ctx.restore()
            continue
          }
          const offscreen = createChartCanvas(
            chartWidth * dpr,
            chartHeight * dpr,
          )
          if (offscreen) {
            offscreen.ctx.scale(dpr, dpr)
            await drawer({ ...props, ctx: offscreen.ctx })
            storeChartCanvas(
              key,
              offscreen.canvas,
              chartCanvasBytes(chartWidth, chartHeight, dpr),
            )
            ctx.drawImage(
              offscreen.canvas as unknown as CanvasImageSource,
              item.x,
              0,
              chartWidth,
              chartHeight,
            )
            ctx.restore()
            continue
          }
        }

        await drawer({ ...props, ctx })
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
  ctx.fillText(TOO_MANY_CHARTS_MESSAGE, width / 2, height / 2)
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
