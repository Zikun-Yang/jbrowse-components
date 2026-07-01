import { useEffect, useRef } from 'react'

import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from '@mui/material'
import { getConf } from '@jbrowse/core/configuration'
import { getContainingView } from '@jbrowse/core/util'
import ReactMarkdown from 'react-markdown'

import { getFeatureChartDrawer } from '../../FeatureChartDrawer/drawerRegistry.ts'
import { renderMarkdownTemplate } from '../../FeatureChartDrawer/renderMarkdownTemplate.ts'

import type { Feature } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import type { LinearFeatureChartDisplayModel } from '../model.ts'

interface MaximizeDialogProps {
  open: boolean
  onClose: () => void
  feature: Feature | undefined
  displayModel: LinearFeatureChartDisplayModel
  chartWidth?: number
  chartHeight?: number
}

const DIALOG_WIDTH = 800
const DIALOG_HEIGHT = 400

export default function MaximizeDialog({
  open,
  onClose,
  feature,
  displayModel,
  chartWidth = DIALOG_WIDTH,
  chartHeight = DIALOG_HEIGHT,
}: MaximizeDialogProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const contextData = feature?.get('contextData') as
    | { data?: unknown; description?: string; name?: string }
    | undefined

  useEffect(() => {
    if (!open || !feature || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const view = getContainingView(displayModel) as LinearGenomeViewModel
    const drawerName = getConf(displayModel, ['renderer', 'drawer']) as string
    const drawer = getFeatureChartDrawer(drawerName)
    if (!drawer) return

    // Scale for high-DPI displays
    const dpr = window.devicePixelRatio || 1
    canvas.width = chartWidth * dpr
    canvas.height = chartHeight * dpr
    canvas.style.width = `${chartWidth}px`
    canvas.style.height = `${chartHeight}px`
    ctx.scale(dpr, dpr)

    ctx.clearRect(0, 0, chartWidth, chartHeight)

    drawer({
      ctx,
      width: chartWidth,
      height: chartHeight,
      data: contextData?.data,
      description: contextData?.description,
      name: contextData?.name ?? feature.get('name'),
      region: view.dynamicBlocks?.contentBlocks?.[0] ?? {
        refName: feature.get('refName'),
        start: feature.get('start'),
        end: feature.get('end'),
        assemblyName: view.assemblyNames?.[0] ?? '',
      },
      bpPerPx:
        ((feature.get('end') as number) - (feature.get('start') as number)) /
        chartWidth,
      feature,
      config: displayModel.rendererConfig,
      theme: {},
      isMaximize: true,
    })
  }, [open, feature, chartWidth, chartHeight, contextData, displayModel])

  const description = contextData?.description
  const renderedDescription = description
    ? renderMarkdownTemplate(description, {
        name: contextData?.name ?? feature?.get('name') ?? '',
        chrom: feature?.get('refName'),
        start: feature?.get('start'),
        end: feature?.get('end'),
        data: contextData?.data,
      })
    : ''

  const handleZoom = () => {
    const view = getContainingView(displayModel) as LinearGenomeViewModel
    if (feature && view?.navToLocString) {
      const refName = feature.get('refName')
      const start = feature.get('start')
      const end = feature.get('end')
      void view.navToLocString(`${refName}:${start}-${end}`)
    }
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{contextData?.name ?? feature?.get('name')}</DialogTitle>
      <DialogContent>
        <canvas
          ref={canvasRef}
          style={{
            width: chartWidth,
            height: chartHeight,
            display: 'block',
            margin: '0 auto 16px',
          }}
        />
        {renderedDescription ? (
          <div className="markdown-body">
            <ReactMarkdown>{renderedDescription}</ReactMarkdown>
          </div>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleZoom}>Zoom to region</Button>
        <Button onClick={onClose} variant="contained">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  )
}
