import { useEffect, useRef } from 'react'

import { getConf } from '@jbrowse/core/configuration'
import { getContainingView, getEnv, getSession } from '@jbrowse/core/util'

import { resolveColorScheme } from '../../FeatureChartDrawer/colorSchemes.ts'
import { warnUnknownDrawerOptions } from '../../FeatureChartDrawer/drawerOptions.ts'
import { resolveFeatureChartDrawer } from '../../FeatureChartDrawer/drawerRegistry.ts'

import type { LinearFeatureChartDisplayModel } from '../model.ts'
import type { Feature } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

/**
 * The large chart inside the maximize dialog.
 *
 * It is a separate component on purpose: MUI `Dialog` mounts its children in a
 * portal *after* the open commit, so a `useEffect` living in the dialog body
 * runs while the canvas ref is still `null` and would never paint. Mounting the
 * canvas as its own component guarantees the effect runs with the element
 * attached.
 */
export default function ChartCanvas({
  feature,
  displayModel,
  width,
  height,
}: {
  feature: Feature
  displayModel: LinearFeatureChartDisplayModel
  width: number
  height: number
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const drawerName = getConf(displayModel, ['renderer', 'drawer']) as string
  const drawerOptions = getConf(displayModel, ['renderer', 'drawerOptions']) as
    | Record<string, unknown>
    | undefined

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) {
      return
    }
    const session = getSession(displayModel)
    // Resolve against the plugin manager (MST env): plugin-contributed drawers
    // (`pluginName/drawerName`) only exist in that catalog.
    const resolution = resolveFeatureChartDrawer(
      drawerName,
      getEnv(displayModel).pluginManager,
    )

    // size before touching the context: the canvas element keeps its default
    // 300x150 backing store until this runs, which is what a blank dialog looks
    // like when the drawing step bails out early
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.max(1, Math.round(width * dpr))
    canvas.height = Math.max(1, Math.round(height * dpr))

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return
    }
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, width, height)

    if (!('drawer' in resolution)) {
      return
    }
    // Same development warning as the in-track canvas: the maximize dialog is
    // the place a user usually notices "my option does nothing".
    warnUnknownDrawerOptions(resolution.meta, drawerOptions)

    const view = getContainingView(displayModel) as LinearGenomeViewModel
    const theme = session.theme
    const contextData = feature.get('contextData') as
      | { data?: unknown; description?: string; name?: string }
      | undefined

    void resolution.drawer({
      ctx,
      width,
      height,
      data: contextData?.data,
      description: contextData?.description,
      name: contextData?.name ?? feature.get('name'),
      region: view.dynamicBlocks.contentBlocks[0] ?? {
        refName: feature.get('refName'),
        start: feature.get('start'),
        end: feature.get('end'),
        assemblyName: view.assemblyNames[0] ?? '',
      },
      bpPerPx: (feature.get('end') - feature.get('start')) / width,
      feature,
      config: displayModel.rendererConfig,
      theme: theme as never,
      colorScheme: resolveColorScheme(
        theme as never,
        getConf(displayModel, ['renderer', 'colorScheme']) as string,
      ),
      options: drawerOptions,
      isMaximize: true,
    })
  }, [feature, displayModel, width, height, drawerName, drawerOptions])

  return (
    <canvas
      ref={ref}
      data-testid="feature-chart-maximize-canvas"
      style={{ width, height, display: 'block', margin: '0 auto 16px' }}
    />
  )
}
