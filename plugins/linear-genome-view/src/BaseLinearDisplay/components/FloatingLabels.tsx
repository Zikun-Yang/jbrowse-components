import { getContainingView } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import { calculateFloatingLabelPosition } from './util.ts'

import type { FeatureTrackModel } from '../../LinearBasicDisplay/model.ts'
import type { LinearGenomeViewModel } from '../../LinearGenomeView/index.ts'

const LABEL_FONT_SIZE = 11
const LEFT_LABEL_GAP = 3

const useStyles = makeStyles()({
  // Full-size overlay container for floating labels
  // pointerEvents:none allows clicks to pass through to features beneath
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: 5,
  },
  // Base label styles - positioned via transform for performance
  // pointerEvents:auto re-enables interaction on the labels themselves
  // lineHeight:1 keeps the text box exactly fontSize tall so inline (left)
  // labels can be vertically centered on the feature body
  label: {
    position: 'absolute',
    fontSize: 11,
    lineHeight: 1,
    cursor: 'default',
    pointerEvents: 'auto',
  },
  // Overlay labels get a semi-transparent background for readability
  overlay: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
})

interface FloatingLabelProps {
  text: string
  color: string
  isOverlay: boolean
  featureId: string
  subfeatureId?: string
  x: number
  y: number
  /** Anchor the label's right edge to x (used for left-placed labels so
   * stacked lines align exactly regardless of text-width estimation error) */
  rightAnchor?: boolean
  tooltip?: string
  labelClass: string
  overlayClass: string
}

// Floating labels need JS calculation to avoid CSS precision issues with large
// coordinates (calc(1000000px - var(--offset-px)) can jitter)
function FloatingLabel({
  text,
  color,
  isOverlay,
  featureId,
  subfeatureId,
  x,
  y,
  rightAnchor,
  tooltip,
  labelClass,
  overlayClass,
}: FloatingLabelProps) {
  return (
    <div
      data-feature-id={featureId}
      data-subfeature-id={subfeatureId}
      data-tooltip={tooltip}
      className={isOverlay ? `${labelClass} ${overlayClass}` : labelClass}
      style={{
        color,
        transform: rightAnchor
          ? `translate(calc(${x}px - 100%), ${y}px)`
          : `translate(${x}px,${y}px)`,
      }}
    >
      {text}
    </div>
  )
}

const FloatingLabels = observer(function FloatingLabels({
  model,
}: {
  model: FeatureTrackModel
}) {
  const { classes } = useStyles()
  const view = getContainingView(model) as LinearGenomeViewModel
  const { offsetPx } = view
  const featureLabels = model.floatingLabelData

  // @ts-expect-error
  const { onFeatureClick, onMouseMove } = model.renderingProps()

  const labels: React.ReactElement[] = []

  for (const [
    key,
    {
      leftPx,
      topPx,
      totalFeatureHeight,
      floatingLabels: labelData,
      featureWidth,
    },
  ] of featureLabels.entries()) {
    const featureVisualBottom = topPx + totalFeatureHeight
    const featureRightPx = leftPx + featureWidth
    const leftLabelCount = labelData.reduce(
      (n, l) => n + (l.placement === 'left' ? 1 : 0),
      0,
    )
    let leftIndex = 0

    for (let i = 0, l = labelData.length; i < l; i++) {
      const floatingLabel = labelData[i]!
      const {
        text,
        relativeY,
        color,
        isOverlay,
        textWidth: labelWidth,
        placement,
        parentFeatureId,
        subfeatureId,
        tooltip,
      } = floatingLabel

      let x: number
      let y: number
      if (placement === 'left') {
        // Inline labels: stacked to the left of the feature, vertically
        // centered on the feature body. x is the label's right edge - the
        // text is right-anchored so stacked lines align exactly
        const blockHeight = leftLabelCount * LABEL_FONT_SIZE
        y =
          topPx +
          (totalFeatureHeight - blockHeight) / 2 +
          leftIndex * LABEL_FONT_SIZE
        x = Math.round(leftPx - LEFT_LABEL_GAP - offsetPx)
        leftIndex++
      } else {
        y = featureVisualBottom + relativeY
        x = calculateFloatingLabelPosition(
          leftPx,
          featureRightPx,
          labelWidth,
          offsetPx,
        )
      }

      const labelKey = `${key}-${i}`
      const featureId = parentFeatureId ?? key

      labels.push(
        <FloatingLabel
          key={labelKey}
          text={text}
          color={color}
          isOverlay={isOverlay ?? false}
          featureId={featureId}
          subfeatureId={subfeatureId}
          x={x}
          y={y}
          rightAnchor={placement === 'left'}
          tooltip={tooltip}
          labelClass={classes.label}
          overlayClass={classes.overlay}
        />,
      )
    }
  }

  return (
    <div
      className={classes.container}
      onClick={e => {
        const target = e.target as HTMLElement
        const subfeatureId = target.dataset.subfeatureId
        const featureId = subfeatureId ?? target.dataset.featureId
        if (featureId) {
          onFeatureClick?.(e, featureId)
        }
      }}
      onMouseOver={e => {
        const target = e.target as HTMLElement
        const featureId = target.dataset.featureId
        if (featureId) {
          const tooltip = target.dataset.tooltip
          const subfeatureId = target.dataset.subfeatureId
          onMouseMove?.(e, featureId, tooltip)
          model.setSubfeatureIdUnderMouse(subfeatureId)
        }
      }}
    >
      {labels}
    </div>
  )
})

export default FloatingLabels
