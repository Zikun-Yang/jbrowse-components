import { readConfObject } from '@jbrowse/core/configuration'
import {
  leftLabelBlockHeight,
  leftLabelReservation,
  measureText,
} from '@jbrowse/core/util'

import { readCachedConfig } from './renderConfig.ts'
import { truncateLabel } from './util.ts'

import type { RenderConfigContext } from './renderConfig.ts'
import type { FeatureLayout } from './types.ts'
import type { Feature } from '@jbrowse/core/util'

/**
 * Calculate label dimensions and update layout accordingly.
 */
export function applyLabelDimensions(
  layout: FeatureLayout,
  args: {
    feature: Feature
    configContext: RenderConfigContext
    isNested: boolean
    isTranscriptChild: boolean
  },
): void {
  const { feature, configContext, isNested, isTranscriptChild } = args
  const {
    config,
    showLabels,
    showDescriptions,
    subfeatureLabels,
    labelPlacement,
    fontHeight,
    labelAllowed,
  } = configContext

  const showSubfeatureLabels = subfeatureLabels !== 'none'
  const shouldCalculateLabels =
    labelAllowed && (!isNested || (isTranscriptChild && showSubfeatureLabels))

  if (!shouldCalculateLabels) {
    return
  }

  const effectiveShowLabels = isTranscriptChild ? true : showLabels
  const effectiveShowDescriptions = isTranscriptChild ? false : showDescriptions

  const name = truncateLabel(
    String(readConfObject(config, ['labels', 'name'], { feature }) || ''),
  )
  const shouldShowName = /\S/.test(name) && effectiveShowLabels

  const description = truncateLabel(
    String(
      readConfObject(config, ['labels', 'description'], { feature }) || '',
    ),
  )
  const shouldShowDescription =
    /\S/.test(description) && effectiveShowDescriptions

  const actualFontHeight = readCachedConfig(
    fontHeight,
    config,
    ['labels', 'fontSize'],
    feature,
  )

  let extraHeightPx = 0
  let maxLabelWidthPx = 0

  if (shouldShowName) {
    extraHeightPx += actualFontHeight
    maxLabelWidthPx = Math.max(
      maxLabelWidthPx,
      measureText(name, actualFontHeight),
    )
  }
  if (shouldShowDescription) {
    extraHeightPx += actualFontHeight
    maxLabelWidthPx = Math.max(
      maxLabelWidthPx,
      measureText(description, actualFontHeight),
    )
  }

  const isOverlayMode = isTranscriptChild && subfeatureLabels === 'overlay'
  const isLeftMode = labelPlacement === 'left' && !isNested
  if (isLeftMode) {
    // Reserve label space to the left of the feature instead of below it.
    // leftPadding/totalLayoutWidth grow equally so the right-side reservation
    // (used by below-mode labels) is unchanged.
    const labelLineCount =
      (shouldShowName ? 1 : 0) + (shouldShowDescription ? 1 : 0)
    const { leftReservation, totalLayoutHeight, yOffset } =
      leftLabelReservation({
        labelLineCount,
        maxLabelWidthPx,
        featureHeight: layout.height,
      })
    if (leftReservation) {
      layout.leftPadding += leftReservation
      layout.totalLayoutWidth += leftReservation
      // Height of the inline text block (name + description lines). Hit
      // testing and the label renderers read it back from the layout, see
      // featureLabelHitBounds/leftLabelLinePosition in @jbrowse/core/util
      layout.leftLabelBlockHeight = leftLabelBlockHeight(labelLineCount)
      // Grow the row to fit the text and center the feature vertically, so
      // the text never extends outside the row (clips at track top /
      // overlaps other rows)
      layout.totalLayoutHeight = totalLayoutHeight
      layout.y += yOffset
    }
  } else {
    if (!isOverlayMode) {
      layout.totalLayoutHeight = layout.height + extraHeightPx
    }
    layout.totalLayoutWidth = Math.max(layout.totalLayoutWidth, maxLabelWidthPx)
  }
}
