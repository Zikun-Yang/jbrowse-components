import { SimpleFeature, renderToAbstractCanvas } from '@jbrowse/core/util'
import { Image, createCanvas } from 'canvas'
import { from } from 'rxjs'

import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'

import { renderFeatureChart } from './renderFeatureChart.ts'
import { registerFeatureChartDrawer } from '../FeatureChartDrawer/drawerRegistry.ts'

// @ts-expect-error
global.nodeImage = Image
// @ts-expect-error
global.nodeCreateCanvas = createCanvas

jest.mock('@jbrowse/core/data_adapters/dataAdapterCache')
jest.mock('d3-scale', () => ({
  scaleBand: () => {
    const scale = (() => 0) as any
    scale.domain = () => scale
    scale.range = () => scale
    scale.padding = () => scale
    scale.bandwidth = () => 20
    return scale
  },
  scaleLinear: () => {
    const scale = ((value: number) => value) as any
    scale.domain = () => scale
    scale.range = () => scale
    scale.nice = () => scale
    scale.ticks = () => [0, 50, 100]
    return scale
  },
}))

describe('renderFeatureChart', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    registerFeatureChartDrawer('testBoxPlot', props => {
      const { ctx, width, height } = props
      ctx.fillStyle = '#eee'
      ctx.fillRect(0, 0, width, height)
    })
  })

  test('renders a single chart into an abstract canvas', async () => {
    const feature = new SimpleFeature({
      id: 'f1',
      data: {
        refName: 'chr1',
        start: 100,
        end: 200,
        name: 'GENE1',
        contextData: {
          data: { tissues: { Brain: [1, 2, 3, 4, 5] } },
          name: 'GENE1',
        },
      },
    })

    const dataAdapter = {
      getFeatures: () => from([feature]),
    }

    ;(getAdapter as jest.Mock).mockResolvedValue({ dataAdapter })

    const result = await renderFeatureChart(
      {
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
        chartHeight: 200,
        chartWidth: 120,
        align: 'center',
        maxChartsPerView: 100,
        minChartSpacingPx: 4,
        drawer: 'testBoxPlot',
        theme: {},
        config: {} as any,
        dataAdapter: undefined as any,
        cannotBeRenderedReason: '',
        renderArgs: {
          sessionId: 'session-1',
          adapterConfig: { type: 'FeatureChartTabixAdapter' },
        } as any,
        rendererType: 'FeatureChartRenderer',
      },
      {} as any,
    )

    expect(result.value).toMatchSnapshot({
      imageData: expect.any(Object),
    })
    expect(result.value.features).toHaveLength(1)
    expect(result.value.height).toBe(200)
  })

  test('shows a warning when charts are too dense', async () => {
    const features = Array.from(
      { length: 5 },
      (_, i) =>
        new SimpleFeature({
          id: `f${i}`,
          data: {
            refName: 'chr1',
            start: 100 + i * 10,
            end: 110 + i * 10,
            name: `GENE${i}`,
            contextData: {
              data: { tissues: { Brain: [1, 2, 3, 4, 5] } },
              name: `GENE${i}`,
            },
          },
        }),
    )

    const dataAdapter = {
      getFeatures: () => from(features),
    }

    ;(getAdapter as jest.Mock).mockResolvedValue({ dataAdapter })

    const result = await renderFeatureChart(
      {
        sessionId: 'session-1',
        adapterConfig: { type: 'FeatureChartTabixAdapter' },
        regions: [
          {
            refName: 'chr1',
            start: 0,
            end: 200,
            assemblyName: 'hg38',
          },
        ],
        bpPerPx: 1,
        chartHeight: 200,
        chartWidth: 120,
        align: 'center',
        maxChartsPerView: 2,
        minChartSpacingPx: 4,
        drawer: 'testBoxPlot',
        theme: {},
        config: {} as any,
        dataAdapter: undefined as any,
        cannotBeRenderedReason: '',
        renderArgs: {
          sessionId: 'session-1',
          adapterConfig: { type: 'FeatureChartTabixAdapter' },
        } as any,
        rendererType: 'FeatureChartRenderer',
      },
      {} as any,
    )

    expect(result.value.features).toHaveLength(5)
    expect(result.value.height).toBe(200)
  })
})
