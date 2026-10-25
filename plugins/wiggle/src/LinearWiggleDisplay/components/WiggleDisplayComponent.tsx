import { getConf } from '@jbrowse/core/configuration'
import {
  getContainingTrack,
  getContainingView,
  measureText,
} from '@jbrowse/core/util'
import { BaseLinearDisplayComponent } from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'

import YScaleBar from '../../shared/YScaleBar.tsx'
import { getYScaleBarLeftPadding } from '../../util.ts'

import type { WiggleDisplayModel } from '../model.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

const LinearWiggleDisplay = observer(function LinearWiggleDisplay(props: {
  model: WiggleDisplayModel
}) {
  const { model } = props
  const { stats, height, graphType } = model

  const { trackLabels } = getContainingView(model) as LGV
  const track = getContainingTrack(model)

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
            // of the view (Settings -> Display -> Y-axis left padding)
            left:
              (trackLabels === 'overlapping'
                ? measureText(getConf(track, 'name'), 12.8) + 100
                : 0) + getYScaleBarLeftPadding(model),
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
