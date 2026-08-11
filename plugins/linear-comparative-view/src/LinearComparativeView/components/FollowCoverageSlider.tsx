import { observer } from 'mobx-react'

import SnappingSlider from './SnappingSlider.tsx'

import type { LinearComparativeViewModel } from '../model.ts'

const COVERAGE_VALUES = [50, 80, 90, 95, 100]

const FollowCoverageSlider = observer(function FollowCoverageSlider({
  model,
}: {
  model: LinearComparativeViewModel
}) {
  return (
    <SnappingSlider
      label="Follow coverage:"
      values={COVERAGE_VALUES}
      value={model.followCumulativePct}
      onChangeCommitted={v => {
        model.setFollowCumulativePct(v)
      }}
      format={v => `${v}%`}
      parse={s => {
        const n = Number(s.replace(/%$/, ''))
        return Number.isFinite(n) ? n : undefined
      }}
    />
  )
})

export default FollowCoverageSlider
