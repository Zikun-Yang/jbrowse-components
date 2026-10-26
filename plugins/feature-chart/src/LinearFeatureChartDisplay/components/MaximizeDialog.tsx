import { useMemo } from 'react'

import { getConf } from '@jbrowse/core/configuration'
import { getContainingView, getEnv } from '@jbrowse/core/util'
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from '@mui/material'
import ReactMarkdown from 'react-markdown'

import ChartCanvas from './ChartCanvas.tsx'
import {
  SPEC_DRAWER_NAME,
  normalizeFromSpec,
} from '../../FeatureChartDrawer/chartSpec.ts'
import { formatFeatureChartDrawerError } from '../../FeatureChartDrawer/drawerErrors.ts'
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

export default function MaximizeDialog({
  open,
  onClose,
  feature,
  displayModel,
  chartWidth = DIALOG_WIDTH,
  chartHeight = DIALOG_HEIGHT,
}: MaximizeDialogProps) {
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
  // The plugin manager lives in the MST env, not on the session model; it is
  // the only catalog that contains plugin-contributed drawers.
  const pluginManager = getEnv(displayModel).pluginManager
  const resolution = useMemo(
    () => resolveFeatureChartDrawer(drawerName, pluginManager),
    [drawerName, pluginManager],
  )
  const drawerError = isFeatureChartDrawerResolutionError(resolution)
    ? formatFeatureChartDrawerError(resolution)
    : null

  // `drawer: "spec"`: list *all* problems here, not just the first one the
  // in-track placeholder could fit. A shape mismatch is almost always a set of
  // them (wrong kind, wrong form, wrong path), and fixing one at a time is the
  // slow way to learn the vocabulary.
  const specErrors =
    drawerName === SPEC_DRAWER_NAME
      ? normalizeFromSpec(
          getConf(displayModel, ['renderer', 'spec']),
          contextData?.data,
        ).errors
      : []

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
        ) : specErrors.length > 0 ? (
          <Alert
            severity="warning"
            sx={{ mb: 2 }}
            data-testid="feature-chart-spec-error"
          >
            Invalid chart spec ({specErrors.length}{' '}
            {specErrors.length === 1 ? 'problem' : 'problems'})
            <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>
              {specErrors.map(error => (
                <li key={`${error.path}-${error.message}`}>
                  <code>{error.path}</code>: {error.message}
                  {error.allowed && error.allowed.length > 0 ? (
                    <div style={{ opacity: 0.8 }}>
                      allowed: {error.allowed.join(', ')}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </Alert>
        ) : feature ? (
          <ChartCanvas
            feature={feature}
            displayModel={displayModel}
            width={chartWidth}
            height={chartHeight}
          />
        ) : null}
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
