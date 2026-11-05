import { useMemo, useState } from 'react'

import { getConf } from '@jbrowse/core/configuration'
import {
  getContainingTrack,
  getContainingView,
  getEnv,
} from '@jbrowse/core/util'
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import ReactMarkdown from 'react-markdown'

import ChartCanvas from './ChartCanvas.tsx'
import MaximizePlotly from './MaximizePlotly.tsx'
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
import {
  canvasPngDataUrl,
  canvasSvgDocument,
  chartExportFileName,
  downloadDataUrl,
  plotlyExportDataUrl,
  svgDataUrl,
} from '../exportChart.ts'

import type { PlotlyExportHandle } from '../../FeatureChartPlotlyRenderer/plotlyLoader.ts'
import type { ChartExportFormat } from '../exportChart.ts'
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

type ChartView = 'interactive' | 'static'

interface ExportStatus {
  format: ChartExportFormat
  bytes: number
  filename: string
}

/**
 * The maximize dialog: one chart, big.
 *
 * WP4 added the two things a researcher actually needs from it — *interaction*
 * (hover/zoom into the Plotly rendering, which is the same model the track
 * draws) and *export* (PNG/SVG named after the track and the feature) — without
 * giving up the pre-WP4 static canvas view, which is what a plugin/`spec`
 * drawer that only paints canvas can offer.
 *
 * Both views are therefore kept, side by side, instead of replacing one with
 * the other.
 */
export default function MaximizeDialog({
  open,
  onClose,
  feature,
  displayModel,
  chartWidth = DIALOG_WIDTH,
  chartHeight = DIALOG_HEIGHT,
}: MaximizeDialogProps) {
  // Defaults to the pre-WP4 static canvas view: opening a dialog must not pull
  // the Plotly chunk, and a canvas-only drawer has no other option. The
  // Interactive tab is one click away (`plotly.js-dist-min` loads on demand).
  const [view, setView] = useState<ChartView>('static')
  const [plotlyHandle, setPlotlyHandle] = useState<PlotlyExportHandle | null>(
    null,
  )
  const [canvasNode, setCanvasNode] = useState<HTMLCanvasElement | null>(null)
  const [exportStatus, setExportStatus] = useState<ExportStatus | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)

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

  const featureName =
    contextData?.name ??
    featureFields?.name ??
    (feature ? feature.id() : 'chart')

  const trackId = useMemo(() => {
    try {
      const track = getContainingTrack(displayModel) as unknown as {
        trackId?: string
        id?: string
      }
      const candidates = [track.trackId, track.id, displayModel.id]
      return (
        candidates.find(
          (value): value is string =>
            typeof value === 'string' && value.length > 0,
        ) ?? 'track'
      )
    } catch {
      return 'track'
    }
  }, [displayModel])

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

  async function handleExport(format: ChartExportFormat) {
    setExportError(null)
    try {
      let dataUrl: string
      if (view === 'interactive') {
        if (!plotlyHandle) {
          throw new Error('the interactive chart is still rendering')
        }
        dataUrl = await plotlyExportDataUrl(plotlyHandle, {
          format,
          width: chartWidth,
          height: chartHeight,
        })
      } else {
        if (!canvasNode) {
          throw new Error('the static chart is not ready')
        }
        const png = canvasPngDataUrl(canvasNode)
        dataUrl =
          format === 'png'
            ? png
            : svgDataUrl(
                canvasSvgDocument(png, {
                  width: chartWidth,
                  height: chartHeight,
                }),
              )
      }
      const filename = chartExportFileName({
        trackId,
        featureName,
        format,
        suffix: view,
      })
      const bytes = downloadDataUrl(dataUrl, filename)
      if (bytes === 0) {
        throw new Error('the exported image is empty')
      }
      setExportStatus({ format, bytes, filename })
    } catch (error) {
      setExportError(error instanceof Error ? error.message : String(error))
    }
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
          <>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                marginBottom: 8,
                flexWrap: 'wrap',
              }}
            >
              <ToggleButtonGroup
                exclusive
                size="small"
                value={view}
                data-testid="feature-chart-view-toggle"
                onChange={(_event, next: ChartView | null) => {
                  if (next) {
                    setView(next)
                    setExportStatus(null)
                    setExportError(null)
                  }
                }}
                aria-label="chart view"
              >
                <ToggleButton
                  value="interactive"
                  data-testid="feature-chart-view-interactive"
                >
                  Interactive
                </ToggleButton>
                <ToggleButton
                  value="static"
                  data-testid="feature-chart-view-static"
                >
                  Static
                </ToggleButton>
              </ToggleButtonGroup>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button
                  size="small"
                  variant="outlined"
                  data-testid="feature-chart-export-png"
                  onClick={() => void handleExport('png')}
                >
                  Export PNG
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  data-testid="feature-chart-export-svg"
                  onClick={() => void handleExport('svg')}
                >
                  Export SVG
                </Button>
              </div>
            </div>
            {view === 'interactive' ? (
              <MaximizePlotly
                feature={feature}
                displayModel={displayModel}
                width={chartWidth}
                height={chartHeight}
                onPlotReady={setPlotlyHandle}
              />
            ) : (
              <ChartCanvas
                feature={feature}
                displayModel={displayModel}
                width={chartWidth}
                height={chartHeight}
                onCanvasReady={setCanvasNode}
              />
            )}
            {view === 'static' ? (
              <Typography variant="caption" color="text.secondary">
                Static export is the canvas render. PNG keeps the device-pixel
                resolution; SVG wraps that raster (a canvas has no vector form)
                — switch to Interactive for a true vector SVG.
              </Typography>
            ) : null}
            {exportError ? (
              <Alert
                severity="error"
                sx={{ mt: 1 }}
                data-testid="feature-chart-export-error"
              >
                {exportError}
              </Alert>
            ) : null}
            {/* Test/automation hook: proves an export produced bytes without
                relying on a browser download folder. */}
            <div
              data-testid="feature-chart-export-status"
              data-format={exportStatus?.format ?? ''}
              data-bytes={exportStatus?.bytes ?? 0}
              data-filename={exportStatus?.filename ?? ''}
              style={{ display: 'none' }}
            >
              {exportStatus
                ? `exported ${exportStatus.filename} (${exportStatus.bytes} bytes)`
                : ''}
            </div>
          </>
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
