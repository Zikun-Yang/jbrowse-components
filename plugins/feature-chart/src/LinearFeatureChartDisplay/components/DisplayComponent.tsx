import { useRef, useState } from 'react'

import { getContainingView } from '@jbrowse/core/util'
import { BaseLinearDisplayComponent } from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'

import { FullscreenIcon } from '@jbrowse/core/ui/Icons'

import MaximizeDialog from './MaximizeDialog.tsx'
import {
  computeChartIconLeft,
  computeChartX,
  findFeatureAtChartX,
} from '../../chartGeometry.ts'
import { resolveFeatureChartRenderSettings } from '../../renderSettings.ts'

import type { LinearFeatureChartDisplayModel } from '../model.ts'
import type { Feature } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const ICON_SIZE = 20

const DisplayComponent = observer(function DisplayComponent({
  model,
}: {
  model: LinearFeatureChartDisplayModel
}) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [hoveredFeature, setHoveredFeature] = useState<Feature>()
  const wrapperRef = useRef<HTMLDivElement>(null)

  const view = getContainingView(model) as LinearGenomeViewModel
  const region = view.dynamicBlocks.contentBlocks[0]
  const settings = resolveFeatureChartRenderSettings(model.rendererConfig)
  const geometry = region
    ? {
        region,
        bpPerPx: view.bpPerPx,
        chartWidth: settings.chartWidth,
        align: settings.align,
      }
    : undefined

  // Hovering is resolved here, on the element that also contains the maximize
  // affordance, so moving the pointer from a chart to its icon never clears the
  // hovered feature and unmounts the icon mid-click. The hit test uses the
  // drawn chart rectangle (see `chartGeometry.ts`): a chart is `chartWidth` px
  // wide however few bases the feature spans, so at most zooms the feature's bp
  // span would be a few pixels and the icon would be effectively unreachable.
  const feature = hoveredFeature ?? model.featureUnderMouse
  const iconLeft =
    feature && geometry
      ? computeChartIconLeft({
          chartLeft: computeChartX(feature, geometry),
          chartWidth: geometry.chartWidth,
          iconSize: ICON_SIZE,
          displayWidth: view.width,
        })
      : 0

  return (
    <div
      ref={wrapperRef}
      data-testid="feature-chart-display"
      style={{ position: 'relative', height: model.height }}
      onMouseMove={e => {
        const left = wrapperRef.current?.getBoundingClientRect().left ?? 0
        const next =
          geometry &&
          findFeatureAtChartX(
            model.features.values(),
            geometry,
            e.clientX - left,
          )
        if (next?.id() !== hoveredFeature?.id()) {
          setHoveredFeature(next)
          // keeps the shared tooltip in sync with the chart under the pointer
          model.setFeatureIdUnderMouse(next?.id())
        }
      }}
      onMouseLeave={() => {
        setHoveredFeature(undefined)
        model.setFeatureIdUnderMouse(undefined)
      }}
    >
      <BaseLinearDisplayComponent model={model} />
      {feature && geometry ? (
        <FullscreenIcon
          role="button"
          aria-label={`Maximize chart ${feature.get('name') ?? ''}`.trim()}
          data-testid="feature-chart-maximize"
          onClick={() => {
            setDialogOpen(true)
          }}
          style={{
            position: 'absolute',
            left: iconLeft,
            top: 4,
            cursor: 'pointer',
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            borderRadius: 4,
            padding: 2,
            fontSize: 18,
            zIndex: 10,
          }}
        />
      ) : null}
      <MaximizeDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false)
        }}
        feature={feature}
        displayModel={model}
      />
    </div>
  )
})

export default DisplayComponent
