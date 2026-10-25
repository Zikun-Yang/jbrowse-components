import { lazy } from 'react'

import { observer } from 'mobx-react'

const LazyWiggleDisplayComponent = lazy(() =>
  import('@jbrowse/plugin-wiggle').then(m => ({
    default: m.LinearWiggleDisplayReactComponent,
  })),
)

/**
 * the wiggle display that the GC content displays render. the window size and
 * step size of the GC content calculation are shown at the left of the track
 * label row, see trackLabelLeftText in ../shared.ts
 */
const GCContentDisplayComponent = observer(function GCContentDisplayComponent({
  model,
}: {
  /** the GC content display model, loosely typed like other display components */
  model: any
}) {
  return <LazyWiggleDisplayComponent model={model} />
})

export default GCContentDisplayComponent
