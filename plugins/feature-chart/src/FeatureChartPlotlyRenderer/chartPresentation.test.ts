import { resolveColorScheme } from '../FeatureChartDrawer/colorSchemes.ts'
import { initBuiltInDrawers } from '../FeatureChartDrawer/drawerRegistry.ts'
import { resolveTrackChartSource } from '../chartModelSources.ts'
import { presentChart } from './chartPresentation.ts'

const themeColorScheme = resolveColorScheme(undefined, 'tableau10')

const base = {
  name: 'GENE_A',
  width: 800,
  height: 400,
  fontSize: 11,
  themeColorScheme,
  interactive: true,
}

const summaryStats = {
  source: 'GTEx (synthetic)',
  boxes: [
    { name: 'Brain', min: 10, q1: 20, median: 30, q3: 40, max: 50 },
    { name: 'Heart', min: 5, q1: 10, median: 15, q3: 20, max: 25 },
  ],
}

const categoryMap = { Brain: [1, 2, 3, 4], Heart: [5, 6, 7, 8] }

function drawerSource(name: string) {
  return resolveTrackChartSource({ drawer: name, spec: undefined })
}

describe('presentChart', () => {
  beforeEach(() => {
    initBuiltInDrawers()
  })

  /**
   * Regression: a track that omits `drawer` (schema default
   * `precomputedBoxPlot`) is in "legacy plotType" mode. The maximize dialog's
   * Interactive view used to send that straight to the `plotType` path, which
   * cannot read the documented `{ source, boxes }` payload and showed
   * "plotType \"box\" does not recognize this payload shape" over a chart the
   * track itself drew without trouble.
   */
  test('legacy mode prefers the drawer model for a model-readable payload', () => {
    const result = presentChart({
      ...base,
      source: drawerSource('precomputedBoxPlot'),
      data: summaryStats,
      useLegacyPlotType: true,
      plotType: 'box',
    })

    expect(result.notice).toBeUndefined()
    expect(result.layout).toBeDefined()
    expect(result.traces.map(trace => trace.name)).toEqual(['Brain', 'Heart'])
    const first = result.traces[0] as {
      type?: string
      q1?: number
      median?: number
    }
    expect(first.type).toBe('box')
    expect(first.median).toBe(30)
  })

  test('legacy mode still draws the category maps plotType was written for', () => {
    const result = presentChart({
      ...base,
      source: drawerSource('precomputedBoxPlot'),
      data: categoryMap,
      useLegacyPlotType: true,
      plotType: 'box',
    })

    expect(result.notice).toBeUndefined()
    expect(result.traces.map(trace => trace.name)).toEqual(['Brain', 'Heart'])
    expect(result.traces[0]).toMatchObject({ type: 'box' })
  })

  test('legacy mode keeps the legacy {x, y} payload support for scatter', () => {
    const result = presentChart({
      ...base,
      source: drawerSource('precomputedBoxPlot'),
      data: { x: [1, 2, 3], y: [4, 5, 6] },
      useLegacyPlotType: true,
      plotType: 'scatter',
    })

    expect(result.notice).toBeUndefined()
    expect(result.traces[0]).toMatchObject({ type: 'scatter' })
  })

  test('a canvas-only drawer is reported, not approximated', () => {
    const result = presentChart({
      ...base,
      source: { drawer: 'samplePlugin/heatmap', canvasOnly: true },
      data: categoryMap,
    })

    expect(result.layout).toBeUndefined()
    expect(result.notice).toContain('canvas-only')
  })

  test('a spec track uses its model', () => {
    const source = resolveTrackChartSource({
      drawer: 'spec',
      spec: {
        specVersion: 1,
        kind: 'box',
        data: { form: 'summary-stats', path: 'boxes' },
        axes: { yLabel: 'TPM' },
      },
    })
    const result = presentChart({ ...base, source, data: summaryStats })

    expect(result.notice).toBeUndefined()
    expect(result.traces.map(trace => trace.name)).toEqual(['Brain', 'Heart'])
    expect(result.layout?.yaxis).toMatchObject({ title: { text: 'TPM' } })
  })
})
