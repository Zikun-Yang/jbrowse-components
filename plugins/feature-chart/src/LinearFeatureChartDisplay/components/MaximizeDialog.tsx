import { useEffect, useMemo, useRef } from 'react'

import { getConf } from '@jbrowse/core/configuration'
import { getContainingView, getSession } from '@jbrowse/core/util'
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from '@mui/material'
import ReactMarkdown from 'react-markdown'

import { resolveColorScheme } from '../../FeatureChartDrawer/colorSchemes.ts'
import {
  isFeatureChartDrawerResolutionError,
  resolveFeatureChartDrawer,
} from '../../FeatureChartDrawer/drawerRegistry.ts'
import { renderMarkdownTemplate } from '../../FeatureChartDrawer/renderMarkdownTemplate.ts'

import type { LinearFeatureChartDisplayModel } from '../model.ts'
import type { Feature } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

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

/** Same message the canvas placeholder shows, for the dialog. */
function describeDrawerError(error: string, available: string[]): string {
  if (available.length === 0) {
    return `${error}. No drawers are registered.`
  }
  return `${error}. Available: ${available.slice(0, 5).join(', ')}`
}

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
  // Snapshot the feature-derived template variables once, so the markdown
  // template block does not need optional chains on the feature itself.
  const featureFields = feature
    ? {
        name: feature.get('name') as string | undefined,
        chrom: feature.get('refName'),
        start: feature.get('start'),
        end: feature.get('end'),
      }
    : undefined

  const drawerName = getConf(displayModel, ['renderer', 'drawer']) as string
  const resolution = useMemo(
    () => resolveFeatureChartDrawer(drawerName),
    [drawerName],
  )
  const drawerError = isFeatureChartDrawerResolutionError(resolution)
    ? describeDrawerError(resolution.error, resolution.available)
    : null

  useEffect(() => {
    if (!open || !feature || isFeatureChartDrawerResolutionError(resolution)) {
      return
    }

    const canvas = canvasRef.current
    if (!canvas) {
      return
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return
    }

    const view = getContainingView(displayModel) as LinearGenomeViewModel
    const theme = getSession(displayModel).theme

    // Scale for high-DPI displays
    const dpr = window.devicePixelRatio || 1
    canvas.width = chartWidth * dpr
    canvas.height = chartHeight * dpr
    canvas.style.width = `${chartWidth}px`
    canvas.style.height = `${chartHeight}px`
    ctx.scale(dpr, dpr)

    ctx.clearRect(0, 0, chartWidth, chartHeight)

    void resolution.drawer({
      ctx,
      width: chartWidth,
      height: chartHeight,
      data: contextData?.data,
      description: contextData?.description,
      name: contextData?.name ?? feature.get('name'),
      region: view.dynamicBlocks.contentBlocks[0] ?? {
        refName: feature.get('refName'),
        start: feature.get('start'),
        end: feature.get('end'),
        assemblyName: view.assemblyNames[0] ?? '',
      },
      bpPerPx: (feature.get('end') - feature.get('start')) / chartWidth,
      feature,
      config: displayModel.rendererConfig,
      theme: theme as any,
      colorScheme: resolveColorScheme(
        theme,
        getConf(displayModel, ['renderer', 'colorScheme']) as string,
      ),
      isMaximize: true,
    })
  }, [
    open,
    feature,
    chartWidth,
    chartHeight,
    contextData,
    displayModel,
    resolution,
  ])

  const description = contextData?.description
  const renderedDescription = description
    ? renderMarkdownTemplate(description, {
        name: contextData.name ?? featureFields?.name ?? '',
        chrom: featureFields?.chrom,
        start: featureFields?.start,
        end: featureFields?.end,
        data: contextData.data,
      })
    : ''

  const handleZoom = () => {
    const view = getContainingView(displayModel) as LinearGenomeViewModel
    if (feature) {
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
        {drawerError ? (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {drawerError}
          </Alert>
        ) : null}
        <canvas
          ref={canvasRef}
          style={{
            width: chartWidth,
            height: chartHeight,
            display: drawerError ? 'none' : 'block',
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
