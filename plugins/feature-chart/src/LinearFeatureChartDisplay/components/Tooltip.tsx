import { observer } from 'mobx-react'

import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'

import type { BaseLinearDisplayModel } from '@jbrowse/plugin-linear-genome-view'

const Tooltip = observer(function Tooltip({
  model,
  clientMouseCoord,
}: {
  model: BaseLinearDisplayModel
  clientMouseCoord: [number, number]
}) {
  const feature = model.featureUnderMouse
  if (!feature) {
    return null
  }

  const contextData = feature.get('contextData') as
    | { description?: string; name?: string }
    | undefined
  const name = (contextData?.name ?? feature.get('name')) as string | undefined

  return (
    <BaseTooltip
      clientPoint={{ x: clientMouseCoord[0] + 15, y: clientMouseCoord[1] }}
    >
      <div style={{ padding: 4 }}>
        <strong>{name ?? feature.id()}</strong>
      </div>
    </BaseTooltip>
  )
})

export default Tooltip
