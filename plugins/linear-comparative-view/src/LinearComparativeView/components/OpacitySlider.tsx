import { observer } from 'mobx-react'

import SnappingSlider from './SnappingSlider.tsx'

import type { LinearSyntenyDisplayModel } from '../../LinearSyntenyDisplay/model.ts'
import type { LinearComparativeViewModel } from '../model.ts'

const OPACITY_VALUES = [0, 0.25, 0.5, 0.75, 1]

const formatOpacity = (v: number) => `${v}`

const OpacitySlider = observer(function OpacitySlider({
  model,
}: {
  model: LinearComparativeViewModel
}) {
  const { levels } = model

  // Get the first synteny display from the first level (if it exists)
  const firstDisplay = levels[0]?.tracks[0]?.displays[0] as
    | LinearSyntenyDisplayModel
    | undefined

  const setAll = (alpha: number) => {
    // Set alpha for all synteny displays across all levels
    for (const level of levels) {
      for (const track of level.tracks) {
        for (const display of track.displays) {
          ;(display as LinearSyntenyDisplayModel).setAlpha(alpha)
        }
      }
    }
  }

  return (
    <SnappingSlider
      label="Opacity:"
      values={OPACITY_VALUES}
      value={firstDisplay?.alpha ?? 1}
      onChange={setAll}
      onChangeCommitted={setAll}
      format={formatOpacity}
    />
  )
})

export default OpacitySlider
