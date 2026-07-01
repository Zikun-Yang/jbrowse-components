import { useState } from 'react'

import FullscreenIcon from '@mui/icons-material/Fullscreen'
import { BaseLinearDisplayComponent } from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'

import MaximizeDialog from './MaximizeDialog.tsx'

import type { LinearFeatureChartDisplayModel } from '../model.ts'

const DisplayComponent = observer(function DisplayComponent({
  model,
}: {
  model: LinearFeatureChartDisplayModel
}) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const feature = model.featureUnderMouse

  return (
    <div style={{ position: 'relative', height: model.height }}>
      <BaseLinearDisplayComponent model={model} />
      {feature ? (
        <FullscreenIcon
          onClick={() => setDialogOpen(true)}
          style={{
            position: 'absolute',
            top: 4,
            right: 4,
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
        onClose={() => setDialogOpen(false)}
        feature={feature}
        displayModel={model}
      />
    </div>
  )
})

export default DisplayComponent
