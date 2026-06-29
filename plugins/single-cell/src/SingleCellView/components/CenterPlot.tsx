import { useEffect, useRef, useState } from 'react'
import { observer } from 'mobx-react'
import { Slider, Typography } from '@mui/material'
import { makeStyles } from '@jbrowse/core/util/tss-react'

import AxesOverlay from './AxesOverlay.tsx'
import EmbeddingCanvas from './EmbeddingCanvas.tsx'
import LabelOverlay from './LabelOverlay.tsx'
import LassoOverlay from './LassoOverlay.tsx'

import type { SingleCellViewModel } from '../model.ts'

const useStyles = makeStyles()(theme => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    height: '100%',
    overflow: 'hidden',
    position: 'relative',
  },
  plotArea: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  controls: {
    position: 'absolute',
    top: theme.spacing(1),
    left: theme.spacing(1),
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(0.5, 1),
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderRadius: theme.shape.borderRadius,
    border: `1px solid ${theme.palette.divider}`,
    zIndex: 1,
  },
  info: {
    position: 'absolute',
    top: theme.spacing(1),
    right: theme.spacing(1),
    padding: theme.spacing(0.5, 1),
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderRadius: theme.shape.borderRadius,
    zIndex: 1,
  },
}))

const CenterPlot = observer(function CenterPlot({
  model,
}: {
  model: SingleCellViewModel
}) {
  const { classes } = useStyles()
  const plotRef = useRef<HTMLDivElement>(null)
  const [plotAreaSize, setPlotAreaSize] = useState({ width: 400, height: 400 })

  useEffect(() => {
    const el = plotRef.current
    if (!el) return

    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const cr = entry.contentRect
        setPlotAreaSize({ width: cr.width, height: cr.height })
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div className={classes.root}>
      <div className={classes.controls}>
        <Typography variant="caption" color="text.secondary">
          Size
        </Typography>
        <Slider
          value={model.pointSize}
          min={1}
          max={10}
          step={0.5}
          onChange={(_, value) => model.setPointSize(value as number)}
          sx={{ width: 80 }}
          size="small"
        />
        <Typography variant="caption" color="text.secondary">
          {model.pointSize.toFixed(1)}
        </Typography>
      </div>

      <div className={classes.info}>
        <Typography variant="caption" color="text.secondary">
          Embedding: <strong>{model.embedding}</strong> | Color by:{' '}
          <strong>{model.colorByName ?? 'none'}</strong>
        </Typography>
      </div>

      <div ref={plotRef} className={classes.plotArea}>
        <AxesOverlay
          width={plotAreaSize.width}
          height={plotAreaSize.height}
          embedding={model.embedding}
        />
        <EmbeddingCanvas
          model={model}
          width={plotAreaSize.width}
          height={plotAreaSize.height}
        />
        <LassoOverlay
          model={model}
          width={plotAreaSize.width}
          height={plotAreaSize.height}
          onLassoEnd={selected => model.setSelectedCells(selected)}
          onRectEnd={selected => model.setSelectedCells(selected)}
        />
        <LabelOverlay
          model={model}
          width={plotAreaSize.width}
          height={plotAreaSize.height}
        />
      </div>
    </div>
  )
})

export default CenterPlot
