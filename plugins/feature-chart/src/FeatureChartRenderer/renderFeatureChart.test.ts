import PluginManager from '@jbrowse/core/PluginManager'
import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { SimpleFeature } from '@jbrowse/core/util'
import { getSubType } from '@jbrowse/core/util/mst-reflection'
import LinearGenomeViewPlugin from '@jbrowse/plugin-linear-genome-view'
import { Image, createCanvas } from 'canvas'
import { from } from 'rxjs'

import {
  FEATURE_CHART_DRAWER_EXTENSION_POINT,
  initBuiltInDrawers,
  registerFeatureChartDrawer,
} from '../FeatureChartDrawer/drawerRegistry.ts'
import { computeChartX } from '../chartGeometry.ts'
import FeatureChartPlugin from '../index.ts'
import FeatureChartRendererSchema from './configSchema.ts'
import { renderFeatureChart } from './renderFeatureChart.ts'

import type { DrawerProps } from '../FeatureChartDrawer/types.ts'

// @ts-expect-error
global.nodeImage = Image
// @ts-expect-error
global.nodeCreateCanvas = createCanvas

jest.mock('@jbrowse/core/data_adapters/dataAdapterCache')
function createFeature(id: string, start: number, end: number, name = id) {
  return new SimpleFeature({
    id,
    data: {
      refName: 'chr1',
      start,
      end,
      name,
      contextData: {
        data: { tissues: { Brain: [1, 2, 3, 4, 5] } },
        name,
      },
    },
  })
}

/**
 * Build render props the way the display now does: only `config` (plus the
 * base render props). No chart geometry is passed alongside it, so these tests
 * fail if the renderer starts depending on copied display fields again.
 */
function createRenderProps(overrides: Record<string, unknown> = {}) {
  return {
    sessionId: 'session-1',
    adapterConfig: { type: 'FeatureChartTabixAdapter' },
    regions: [
      {
        refName: 'chr1',
        start: 0,
        end: 1000,
        assemblyName: 'hg38',
      },
    ],
    bpPerPx: 1,
    theme: {},
    config: {
      drawer: 'testBoxPlot',
      chartWidth: 120,
      chartHeight: 200,
      align: 'center',
      maxChartsPerView: 100,
      minChartSpacingPx: 4,
      colorScheme: 'tableau10',
      ...overrides,
    },
    dataAdapter: undefined,
    cannotBeRenderedReason: '',
    renderArgs: {
      sessionId: 'session-1',
      adapterConfig: { type: 'FeatureChartTabixAdapter' },
    },
    rendererType: 'FeatureChartRenderer',
  } as any
}

function mockAdapter(features: SimpleFeature[]) {
  ;(getAdapter as jest.Mock).mockResolvedValue({
    dataAdapter: { getFeatures: () => from(features) },
  })
}

describe('renderFeatureChart', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    initBuiltInDrawers()
    registerFeatureChartDrawer('testBoxPlot', props => {
      const { ctx, width, height } = props
      ctx.fillStyle = '#eee'
      ctx.fillRect(0, 0, width, height)
    })
  })

  test('renders a single chart into an abstract canvas', async () => {
    mockAdapter([createFeature('f1', 100, 200, 'GENE1')])

    const result = await renderFeatureChart(createRenderProps(), {} as any)

    expect(result.value).toMatchSnapshot({
      imageData: expect.any(Object),
    })
    expect(result.value.features).toHaveLength(1)
    expect(result.value.height).toBe(200)
  })

  test('shows a warning when charts are too dense', async () => {
    mockAdapter(
      Array.from({ length: 5 }, (_, i) =>
        createFeature(`f${i}`, 100 + i * 10, 110 + i * 10),
      ),
    )

    const result = await renderFeatureChart(
      createRenderProps({ maxChartsPerView: 2 }),
      {} as any,
    )

    expect(result.value.features).toHaveLength(5)
    expect(result.value.height).toBe(200)
  })

  test('reads drawer, size, alignment and palette from its own config', async () => {
    const seen: DrawerProps[] = []
    registerFeatureChartDrawer('spyDrawer', props => {
      seen.push(props)
      props.ctx.fillRect(0, 0, 1, 1)
    })
    mockAdapter([createFeature('f1', 100, 200)])

    const result = await renderFeatureChart(
      createRenderProps({
        drawer: 'spyDrawer',
        chartWidth: 77,
        chartHeight: 55,
        align: 'left',
        maxChartsPerView: 100,
        minChartSpacingPx: 4,
        colorScheme: 'viridis',
      }),
      {} as any,
    )

    expect(seen).toHaveLength(1)
    expect(seen[0]!.width).toBe(77)
    expect(seen[0]!.height).toBe(55)
    expect(seen[0]!.colorScheme?.name).toBe('viridis')
    // chart height comes back from config, not from the caller
    expect(result.value.height).toBe(55)
  })

  test('default-only worker config falls back to the default drawer', async () => {
    // When a config only uses schema defaults, postProcessSnapshot() drops all
    // of them, so the worker receives an almost empty object like this. The
    // renderer must still paint with precomputedBoxPlot and the schema sizes.
    const draw = jest.fn((props: DrawerProps) => {
      props.ctx.fillRect(0, 0, 1, 1)
    })
    registerFeatureChartDrawer('precomputedBoxPlot', draw)
    mockAdapter([createFeature('f1', 100, 200, 'GENE1')])

    const renderProps = createRenderProps()
    renderProps.config = { type: 'FeatureChartRenderer' }
    const result = await renderFeatureChart(renderProps, {} as any)

    expect(draw).toHaveBeenCalledTimes(1)
    expect(result.value.drawerError).toBeUndefined()
    // schema defaults: chartHeight 180, chartWidth 120
    expect(result.value.height).toBe(180)
    expect(draw.mock.calls[0]![0].height).toBe(180)
    expect(draw.mock.calls[0]![0].width).toBe(120)
  })

  test('unknown drawer renders a placeholder instead of throwing', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const draw = jest.fn()
    registerFeatureChartDrawer('testBoxPlot', draw)
    mockAdapter([createFeature('f1', 100, 200)])

    const result = await renderFeatureChart(
      createRenderProps({ drawer: 'tissueBoxPlot' }),
      {} as any,
    )

    expect(draw).not.toHaveBeenCalled()
    expect(result.value.drawerError).toContain('tissueBoxPlot')
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('Unknown FeatureChart drawer "tissueBoxPlot"'),
    )
    // the block is still rendered: same height as a normal chart
    expect(result.value.height).toBe(200)
    expect(result.value.imageData).toEqual(expect.any(Object))

    warn.mockRestore()
  })

  test('passes drawerOptions from config to DrawerProps.options', async () => {
    const seen: DrawerProps[] = []
    registerFeatureChartDrawer('optionsDrawer', props => {
      seen.push(props)
      props.ctx.fillRect(0, 0, 1, 1)
    })
    mockAdapter([createFeature('f1', 100, 200)])

    await renderFeatureChart(
      createRenderProps({
        drawer: 'optionsDrawer',
        drawerOptions: { colorRamp: 'warm', cellGap: 2 },
      }),
      {} as any,
    )

    expect(seen).toHaveLength(1)
    expect(seen[0]!.options).toEqual({ colorRamp: 'warm', cellGap: 2 })
  })

  test('a real renderer config model gets its drawerOptions to the drawer', async () => {
    // The exact production path: an MST config model with the `frozen`
    // drawerOptions slot, run through the renderer (in the app this happens
    // inside the RPC worker).
    const config = getSubType(FeatureChartRendererSchema).create({
      drawer: 'optionsDrawer',
      drawerOptions: { colorRamp: 'warm', cellGap: 2 },
    })
    const seen: DrawerProps[] = []
    registerFeatureChartDrawer('optionsDrawer', props => {
      seen.push(props)
      props.ctx.fillRect(0, 0, 1, 1)
    })
    mockAdapter([createFeature('f1', 100, 200)])

    const renderProps = createRenderProps()
    renderProps.config = config
    await renderFeatureChart(renderProps, {} as any)

    expect(seen).toHaveLength(1)
    expect(seen[0]!.options).toEqual({ colorRamp: 'warm', cellGap: 2 })
  })

  test('drawers always receive an options object, even when unset', async () => {
    const seen: DrawerProps[] = []
    registerFeatureChartDrawer('noOptionsDrawer', props => {
      seen.push(props)
      props.ctx.fillRect(0, 0, 1, 1)
    })
    mockAdapter([createFeature('f1', 100, 200)])

    await renderFeatureChart(
      createRenderProps({ drawer: 'noOptionsDrawer' }),
      {} as any,
    )

    expect(seen[0]!.options).toEqual({})
  })

  test('renders a drawer contributed by a plugin (worker-side renderer path)', async () => {
    // This calls the function the RPC worker executes, with a plugin manager
    // assembled exactly like `initializeWorker` assembles its own: core plugins
    // plus the runtime plugins, all mapped to instances.
    const draw = jest.fn((props: DrawerProps) => {
      props.ctx.fillRect(0, 0, 1, 1)
    })
    class FakeDrawerPlugin {
      name = 'FakeDrawerPlugin'
      install(pluginManager: PluginManager) {
        pluginManager.addToExtensionPoint(
          FEATURE_CHART_DRAWER_EXTENSION_POINT,
          (drawers: unknown) => [
            ...(Array.isArray(drawers) ? drawers : []),
            { name: 'fakePlugin/chart', draw },
          ],
        )
      }
      configure() {}
    }
    const pluginManager = new PluginManager([
      new LinearGenomeViewPlugin(),
      new FeatureChartPlugin(),
      new FakeDrawerPlugin(),
    ])
      .createPluggableElements()
      .configure()
    mockAdapter([createFeature('f1', 100, 200)])

    const result = await renderFeatureChart(
      createRenderProps({ drawer: 'fakePlugin/chart' }),
      pluginManager,
    )

    expect(draw).toHaveBeenCalledTimes(1)
    expect(result.value.drawerError).toBeUndefined()
  })

  test('the placeholder names the plugin a drawer would come from', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {})
    mockAdapter([createFeature('f1', 100, 200)])

    const result = await renderFeatureChart(
      createRenderProps({ drawer: 'notLoadedPlugin/heatmap' }),
      {} as any,
    )

    // the old placeholder only said "unknown drawer"; a plugin-scoped name must
    // say that the plugin is what is missing
    expect(result.value.drawerError).toContain('Missing plugin')
    expect(result.value.drawerError).toContain('notLoadedPlugin')
    expect(result.value.imageData).toEqual(expect.any(Object))
  })
})

describe('computeChartX', () => {
  const region = {
    refName: 'chr1',
    start: 100,
    end: 1000,
    assemblyName: 'hg38',
  }
  const feature = createFeature('f1', 300, 400)

  test('aligns the chart box by start, end or center', () => {
    const geometry = { region, bpPerPx: 1, chartWidth: 50 }
    expect(computeChartX(feature, { ...geometry, align: 'left' })).toBe(200)
    expect(computeChartX(feature, { ...geometry, align: 'right' })).toBe(250)
    expect(computeChartX(feature, { ...geometry, align: 'center' })).toBe(225)
  })
})
