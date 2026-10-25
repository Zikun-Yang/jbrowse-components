import { BaseLinearDisplayComponent } from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'

import YScaleBars from './YScaleBars.tsx'

import type { WiggleDisplayModel } from '../model.ts'

const MultiLinearWiggleDisplayComponent = observer(
  function MultiLinearWiggleDisplayComponent(props: {
    model: WiggleDisplayModel
  }) {
    const { model } = props

    // Note: row labels for the multi-row renders are drawn by the ColorLegend
    // in YScaleBars (see IndividualScaleBars), so don't add another row label
    // layer here
    return (
      <div>
        <BaseLinearDisplayComponent {...props} />
        <YScaleBars model={model} />
      </div>
    )
  },
)

export default MultiLinearWiggleDisplayComponent
