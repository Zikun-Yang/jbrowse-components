import {
  FLOATING_LABEL_FONT_SIZE,
  FLOATING_LABEL_GAP,
  featureLabelHitBounds,
  leftLabelBlockHeight,
  leftLabelLinePosition,
  leftLabelReservation,
  leftLabelReservedWidth,
} from './featureLabelLayout.ts'

describe('featureLabelLayout', () => {
  describe('leftLabelBlockHeight', () => {
    test('is one font line per label', () => {
      expect(leftLabelBlockHeight(0)).toBe(0)
      expect(leftLabelBlockHeight(1)).toBe(FLOATING_LABEL_FONT_SIZE)
      expect(leftLabelBlockHeight(2)).toBe(2 * FLOATING_LABEL_FONT_SIZE)
    })
  })

  describe('leftLabelReservedWidth', () => {
    test('reserves the text width plus the gap', () => {
      expect(leftLabelReservedWidth(40)).toBe(40 + FLOATING_LABEL_GAP)
    })

    test('reserves nothing when there is no text', () => {
      expect(leftLabelReservedWidth(0)).toBe(0)
    })
  })

  describe('leftLabelReservation', () => {
    test('grows the row when the label block is taller than the feature', () => {
      expect(
        leftLabelReservation({
          labelLineCount: 2,
          maxLabelWidthPx: 40,
          featureHeight: 10,
        }),
      ).toEqual({
        leftReservation: 40 + FLOATING_LABEL_GAP,
        totalLayoutHeight: 2 * FLOATING_LABEL_FONT_SIZE,
        yOffset: (2 * FLOATING_LABEL_FONT_SIZE - 10) / 2,
      })
    })

    test('keeps the feature height when the label block fits', () => {
      expect(
        leftLabelReservation({
          labelLineCount: 1,
          maxLabelWidthPx: 40,
          featureHeight: 30,
        }),
      ).toEqual({
        leftReservation: 40 + FLOATING_LABEL_GAP,
        totalLayoutHeight: 30,
        yOffset: 0,
      })
    })

    test('reserves nothing without label text', () => {
      expect(
        leftLabelReservation({
          labelLineCount: 2,
          maxLabelWidthPx: 0,
          featureHeight: 10,
        }),
      ).toEqual({ leftReservation: 0, totalLayoutHeight: 10, yOffset: 0 })
    })
  })

  describe('leftLabelLinePosition', () => {
    test('right-anchors the text to the left of the feature', () => {
      const { x } = leftLabelLinePosition({
        featureTopPx: 100,
        featureHeight: 10,
        featureLeftPx: 50,
        lineIndex: 0,
        lineCount: 1,
      })
      expect(x).toBe(50 - FLOATING_LABEL_GAP)
    })

    test('applies the viewport offset', () => {
      const { x } = leftLabelLinePosition({
        featureTopPx: 100,
        featureHeight: 10,
        featureLeftPx: 50,
        lineIndex: 0,
        lineCount: 1,
        offsetPx: 20,
      })
      expect(x).toBe(50 - FLOATING_LABEL_GAP - 20)
    })

    test('centers a single line on the feature body', () => {
      const { y } = leftLabelLinePosition({
        featureTopPx: 100,
        featureHeight: 10,
        featureLeftPx: 0,
        lineIndex: 0,
        lineCount: 1,
      })
      expect(y).toBe(100 + (10 - FLOATING_LABEL_FONT_SIZE) / 2)
    })

    test('stacks multiple lines inside the centered block', () => {
      const first = leftLabelLinePosition({
        featureTopPx: 100,
        featureHeight: 10,
        featureLeftPx: 0,
        lineIndex: 0,
        lineCount: 2,
      })
      const second = leftLabelLinePosition({
        featureTopPx: 100,
        featureHeight: 10,
        featureLeftPx: 0,
        lineIndex: 1,
        lineCount: 2,
      })
      expect(first.y).toBe(100 + (10 - 2 * FLOATING_LABEL_FONT_SIZE) / 2)
      expect(second.y - first.y).toBe(FLOATING_LABEL_FONT_SIZE)
    })
  })

  describe('featureLabelHitBounds', () => {
    test('covers the reserved label block and the feature', () => {
      const bounds = featureLabelHitBounds({
        x: 50,
        y: 94,
        height: 10,
        leftPadding: 43,
        totalLayoutWidth: 100,
        totalLayoutHeight: 22,
        leftLabelBlockHeight: 22,
      })
      expect(bounds).toEqual({
        left: 50 - 43,
        right: 50 - 43 + 100,
        // row grew from 10 to 22, so it starts 6px above the feature body
        top: 94 - 6,
        bottom: 94 - 6 + 22,
      })
    })

    test('does not grow when there is no label block', () => {
      const bounds = featureLabelHitBounds({
        x: 50,
        y: 94,
        height: 10,
        leftPadding: 0,
        totalLayoutWidth: 100,
        totalLayoutHeight: 10,
      })
      expect(bounds).toEqual({
        left: 50,
        right: 150,
        top: 94,
        bottom: 104,
      })
    })
  })
})
