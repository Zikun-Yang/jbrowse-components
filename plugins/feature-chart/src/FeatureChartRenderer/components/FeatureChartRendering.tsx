import { PrerenderedCanvas } from '@jbrowse/core/ui'

import type { Feature } from '@jbrowse/core/util'
import type { Region } from '@jbrowse/core/util/types'
import type { BaseLinearDisplayModel } from '@jbrowse/plugin-linear-genome-view'

/**
 * Paints the prerendered chart canvas. Hover handling lives in the display
 * component (`LinearFeatureChartDisplay/components/DisplayComponent`), which
 * owns both the chart and the maximize affordance: hit-testing a chart is a
 * chart-rectangle question (`chartGeometry.ts`), not a `PrerenderedCanvas`
 * concern, and keeping one owner is what makes the icon clickable.
 */
const FeatureChartRendering = function FeatureChartRendering(props: {
  regions: Region[]
  features: Map<string, Feature>
  bpPerPx: number
  width: number
  height: number
  blockKey: string
  displayModel: BaseLinearDisplayModel
}) {
  return (
    <div
      data-testid="feature-chart-rendering-test"
      style={{
        overflow: 'visible',
        position: 'relative',
        height: props.height,
      }}
    >
      <PrerenderedCanvas {...props} />
    </div>
  )
}

export default FeatureChartRendering
