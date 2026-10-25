import { BaseLinearDisplayComponent } from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'

import YScaleBar from '../../shared/YScaleBar.tsx'
import { getYScaleBarLeftPadding } from '../../util.ts'

import type { WiggleDisplayModel } from '../model.ts'

const LinearWiggleDisplay = observer(function LinearWiggleDisplay(props: {
  model: WiggleDisplayModel
}) {
  const { model } = props
  const { stats, height, graphType } = model

  return (
    <div>
      <BaseLinearDisplayComponent {...props} />
      {stats && graphType ? (
        <svg
          data-testid="y-scale-bar"
          style={{
            position: 'absolute',
            top: 0,
            // the y-scale bar sits yScaleBarLeftPadding px from the left edge
            // of the view (Settings -> Display -> Y-axis left padding). nothing
            // is added for the track label: labels always get their own row
            // above the track (see plugins/linear-genome-view
            // TrackLabelContainer), never drawn over the track, so the old
            // "overlapping" reservation of measureText(name) + 100 px from
            // upstream jbrowse only left a gap between the edge of the view and
            // the scale bar
            left: getYScaleBarLeftPadding(model),
            pointerEvents: 'none',
            height,
            width: 50,
          }}
        >
          <YScaleBar model={model} />
        </svg>
      ) : null}
    </div>
  )
})

export default LinearWiggleDisplay
