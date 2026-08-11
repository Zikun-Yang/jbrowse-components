import { toLocale } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import SnappingSlider from './SnappingSlider.tsx'

import type { LinearSyntenyDisplayModel } from '../../LinearSyntenyDisplay/model.ts'
import type { LinearComparativeViewModel } from '../model.ts'

const MIN_LENGTH_VALUES = [0, 100, 1000, 10000, 100000]

// log-ish spacing so each decade gets similar screen width; +10 keeps 0 finite
const toPos = (v: number) => Math.log10(v + 10)
const fromPos = (p: number) => 10 ** p - 10

const MinLengthSlider = observer(function MinLengthSlider({
  model,
}: {
  model: LinearComparativeViewModel
}) {
  const { levels } = model

  // Get the first synteny display from the first level (if it exists)
  const firstDisplay = levels[0]?.tracks[0]?.displays[0] as
    | LinearSyntenyDisplayModel
    | undefined

  const setAll = (minAlignmentLength: number) => {
    // Set minAlignmentLength for all synteny displays across all levels
    for (const level of levels) {
      for (const track of level.tracks) {
        for (const display of track.displays) {
          ;(display as LinearSyntenyDisplayModel).setMinAlignmentLength(
            Math.round(minAlignmentLength),
          )
        }
      }
    }
  }

  return (
    <SnappingSlider
      label="Min length:"
      values={MIN_LENGTH_VALUES}
      value={firstDisplay?.minAlignmentLength ?? 0}
      onChangeCommitted={setAll}
      format={toLocale}
      toPos={toPos}
      fromPos={fromPos}
    />
  )
})

export default MinLengthSlider
