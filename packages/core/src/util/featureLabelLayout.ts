/**
 * Geometry for the inline feature labels that are placed to the left of a
 * feature.
 *
 * The canvas feature renderer reserves space for these labels and builds the
 * clickable/hoverable rectangles, while the DOM overlay and the SVG export
 * draw the text. All three live in different packages, so the formulas are
 * kept here: the reserved space, the hit rectangles and the drawn text cannot
 * drift apart.
 */

/** Font size of floating labels (DOM overlay and SVG export) */
export const FLOATING_LABEL_FONT_SIZE = 11

/** Gap between the feature body and a left-side label block */
export const FLOATING_LABEL_GAP = 3

/** Vertical space used by a left-side label block with `lineCount` lines */
export function leftLabelBlockHeight(lineCount: number) {
  return lineCount * FLOATING_LABEL_FONT_SIZE
}

/** Horizontal space a left-side label block reserves (0 when there is no text) */
export function leftLabelReservedWidth(maxLabelWidthPx: number) {
  return maxLabelWidthPx > 0 ? maxLabelWidthPx + FLOATING_LABEL_GAP : 0
}

/**
 * Space a left-side label block reserves around the feature body.
 *
 * - `leftReservation` is added to the feature's left padding and total width
 * - `totalLayoutHeight` is the row height needed to fit the label block
 * - `yOffset` is how far down the feature body moves so that it stays
 *   vertically centered in that row
 */
export function leftLabelReservation({
  labelLineCount,
  maxLabelWidthPx,
  featureHeight,
}: {
  labelLineCount: number
  maxLabelWidthPx: number
  featureHeight: number
}) {
  const leftReservation = leftLabelReservedWidth(maxLabelWidthPx)
  if (!leftReservation) {
    return { leftReservation: 0, totalLayoutHeight: featureHeight, yOffset: 0 }
  }
  const blockHeight = leftLabelBlockHeight(labelLineCount)
  const totalLayoutHeight = Math.max(featureHeight, blockHeight)
  return {
    leftReservation,
    totalLayoutHeight,
    yOffset: (totalLayoutHeight - featureHeight) / 2,
  }
}

/**
 * Position of one line of a left-side label block, in canvas pixels.
 *
 * `x` is the right edge of the text: left labels are right-anchored so the
 * lines of a multi-line block align exactly. `y` is the top of the line; the
 * block as a whole is vertically centered on the feature body.
 */
export function leftLabelLinePosition({
  featureTopPx,
  featureHeight,
  featureLeftPx,
  lineIndex,
  lineCount,
  offsetPx = 0,
}: {
  featureTopPx: number
  featureHeight: number
  featureLeftPx: number
  lineIndex: number
  lineCount: number
  offsetPx?: number
}) {
  const blockHeight = leftLabelBlockHeight(lineCount)
  return {
    x: Math.round(featureLeftPx - FLOATING_LABEL_GAP - offsetPx),
    y:
      featureTopPx +
      (featureHeight - blockHeight) / 2 +
      lineIndex * FLOATING_LABEL_FONT_SIZE,
  }
}

/**
 * Hit-test rectangle of a feature that has left-side labels.
 *
 * The feature body is vertically centered in a row that is grown to fit the
 * label block, so the rectangle has to grow symmetrically around the body and
 * reach to the left of it (`leftPadding`) to cover the labels.
 */
export function featureLabelHitBounds({
  x,
  y,
  height,
  leftPadding,
  totalLayoutWidth,
  totalLayoutHeight,
  leftLabelBlockHeight: blockHeight,
}: {
  x: number
  y: number
  height: number
  leftPadding: number
  totalLayoutWidth: number
  totalLayoutHeight: number
  leftLabelBlockHeight?: number
}) {
  const extraLabelHeight =
    blockHeight && blockHeight > height ? (blockHeight - height) / 2 : 0
  return {
    left: x - leftPadding,
    right: x - leftPadding + totalLayoutWidth,
    top: y - extraLabelHeight,
    bottom: y - extraLabelHeight + totalLayoutHeight,
  }
}
