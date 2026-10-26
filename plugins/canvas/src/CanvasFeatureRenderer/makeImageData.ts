import { readConfObject } from '@jbrowse/core/configuration'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import { bpToPx, featureLabelHitBounds } from '@jbrowse/core/util'
import Flatbush from '@jbrowse/core/util/flatbush'
import { checkStopToken2 } from '@jbrowse/core/util/stopToken'

import { drawFeature } from './drawFeature.ts'
import {
  buildChildrenIndex,
  convertToCanvasCoords,
} from './layout/layoutUtils.ts'

import type { RenderConfigContext } from './renderConfig.ts'
import type {
  DrawContext,
  FlatbushItem,
  LayoutRecord,
  RenderArgs,
  SubfeatureInfo,
} from './types.ts'

function buildFlatbush(coords: number[], count: number) {
  const fb = new Flatbush(Math.max(count, 1))
  if (coords.length) {
    for (let i = 0; i < coords.length; i += 4) {
      fb.add(coords[i]!, coords[i + 1]!, coords[i + 2], coords[i + 3])
    }
  } else {
    fb.add(0, 0, 0, 0)
  }
  fb.finish()
  return fb
}

/**
 * Phase 2: Render all features to canvas.
 *
 * This is the draw phase of the two-phase rendering:
 * 1. Layouts have already been computed in Phase 1 (layoutFeatures)
 * 2. Here we convert local coords to canvas coords and draw each feature
 * 3. Build Flatbush spatial indexes for hit detection
 */
export function makeImageData({
  ctx,
  layoutRecords,
  canvasWidth,
  renderArgs,
  configContext,
}: {
  ctx: CanvasRenderingContext2D
  layoutRecords: LayoutRecord[]
  canvasWidth: number
  renderArgs: RenderArgs
  configContext: RenderConfigContext
}) {
  const {
    bpPerPx,
    regions,
    theme: configTheme,
    stopTokenCheck,
    layout,
    peptideDataMap,
    pluginManager,
  } = renderArgs

  const region = regions[0]!
  const theme = createJBrowseTheme(configTheme)

  // Create draw context once - shared across all features
  const drawContext: DrawContext = {
    region,
    bpPerPx,
    configContext,
    theme,
    canvasWidth,
    peptideDataMap,
  }

  // Hit detection data
  const coords: number[] = []
  const items: FlatbushItem[] = []
  const subfeatureCoords: number[] = []
  const subfeatureInfos: SubfeatureInfo[] = []

  ctx.textBaseline = 'top'
  ctx.textAlign = 'left'

  const { subfeatureLabels, transcriptTypes, config } = configContext

  for (const record of layoutRecords) {
    const { feature, layout: featureLayout, topPx: recordTopPx } = record

    // Convert local coordinates to canvas coordinates
    const featureStartBp = feature.get(region.reversed ? 'end' : 'start')
    const startPx = bpToPx(featureStartBp, region, bpPerPx)
    const canvasLayout = convertToCanvasCoords(
      featureLayout,
      startPx,
      recordTopPx,
    )

    // Draw the feature (all coordinates are now in canvas space)
    drawFeature(ctx, canvasLayout, drawContext, pluginManager)

    // Build hit detection indexes
    // The hit rectangle (which covers leftPadding for left-side arrows and
    // labels, and grows symmetrically around a feature with left labels) is
    // derived from the layout by featureLabelHitBounds so it stays in sync
    // with what labelUtils reserved and with what the label renderers draw
    const bounds = featureLabelHitBounds(canvasLayout)

    const label = String(
      readConfObject(config, ['labels', 'name'], { feature }) || '',
    )
    const description = String(
      readConfObject(config, ['labels', 'description'], { feature }) || '',
    )
    const tooltip = String(
      readConfObject(config, 'mouseover', { feature, label, description }) ||
        '',
    )

    coords.push(bounds.left, bounds.top, bounds.right, bounds.bottom)
    items.push({
      featureId: feature.id(),
      type: 'box',
      startBp: feature.get('start'),
      endBp: feature.get('end'),
      leftPx: bounds.left,
      rightPx: bounds.right,
      topPx: bounds.top,
      bottomPx: bounds.bottom,
      tooltip,
    })

    // Build subfeature index for hit detection and floating labels
    buildChildrenIndex({
      layout,
      featureLayout: canvasLayout,
      subfeatureCoords,
      subfeatureInfos,
      config,
      configContext,
      pluginManager,
      subfeatureLabels,
      transcriptTypes,
      labelColor: theme.palette.text.primary,
      parentTooltip: tooltip,
    })

    checkStopToken2(stopTokenCheck)
  }

  return {
    flatbush: buildFlatbush(coords, items.length).data,
    items,
    subfeatureFlatbush: buildFlatbush(subfeatureCoords, subfeatureInfos.length)
      .data,
    subfeatureInfos,
  }
}
