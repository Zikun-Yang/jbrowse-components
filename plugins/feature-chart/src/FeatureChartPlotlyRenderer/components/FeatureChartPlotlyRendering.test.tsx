import { SimpleFeature } from '@jbrowse/core/util'
import { render, waitFor } from '@testing-library/react'

import FeatureChartPlotlyRendering from './FeatureChartPlotlyRendering.tsx'
import {
  initBuiltInDrawers,
  registerFeatureChartDrawer,
} from '../../FeatureChartDrawer/drawerRegistry.ts'
import { resetPlotTypeDeprecationWarnings } from '../plotTypeCompat.ts'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { BaseLinearDisplayModel } from '@jbrowse/plugin-linear-genome-view'

const mockNewPlot = jest.fn().mockResolvedValue(undefined)
const mockPurge = jest.fn().mockResolvedValue(undefined)

jest.mock('plotly.js-dist-min', () => ({
  __esModule: true,
  default: {
    newPlot: (...args: unknown[]) => mockNewPlot(...args),
    purge: (...args: unknown[]) => mockPurge(...args),
  },
}))

const mockDisplayModel = {
  setFeatureIdUnderMouse: jest.fn(),
} as unknown as BaseLinearDisplayModel

function createFeature(id: string, start: number, end: number, data: unknown) {
  return new SimpleFeature({
    id,
    data: {
      refName: 'chr1',
      start,
      end,
      name: id,
      contextData: {
        data,
        name: id,
      },
    },
  })
}

const config = {
  chartHeight: 180,
  chartWidth: 120,
  align: 'center',
  plotType: 'box',
  maxChartsPerView: 100,
  minChartSpacingPx: 4,
} as unknown as AnyConfigurationModel

const region = [{ refName: 'chr1', start: 0, end: 1000, assemblyName: 'hg38' }]

function renderWith(config: AnyConfigurationModel, data: unknown) {
  const feature = createFeature('f1', 100, 200, data)
  return render(
    <FeatureChartPlotlyRendering
      features={new Map([[feature.id(), feature]])}
      regions={region}
      bpPerPx={1}
      width={1000}
      height={180}
      blockKey="block"
      displayModel={mockDisplayModel}
      config={config}
    />,
  )
}

describe('FeatureChartPlotlyRendering', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    initBuiltInDrawers()
    resetPlotTypeDeprecationWarnings()
  })

  test('renders a Plotly chart per feature', async () => {
    const featureList = [
      createFeature('f1', 100, 200, {
        Brain: [1, 2, 3, 4, 5],
        Heart: [2, 3, 4, 5, 6],
      }),
      createFeature('f2', 500, 600, {
        Brain: [5, 6, 7],
        Heart: [8, 9, 10],
      }),
    ]
    const features = new Map(featureList.map(f => [f.id(), f]))

    render(
      <FeatureChartPlotlyRendering
        features={features}
        regions={[
          {
            refName: 'chr1',
            start: 0,
            end: 1000,
            assemblyName: 'hg38',
          },
        ]}
        bpPerPx={1}
        width={1000}
        height={180}
        blockKey="block-1"
        displayModel={mockDisplayModel}
        config={config}
      />,
    )

    await waitFor(() => {
      expect(mockNewPlot).toHaveBeenCalledTimes(2)
    })

    const firstCall = mockNewPlot.mock.calls[0]!
    const firstTraces = firstCall[1] as { type?: string; name?: string }[]
    expect(firstTraces).toHaveLength(2)
    expect(firstTraces[0]!.type).toBe('box')
    expect(firstTraces[0]!.name).toBe('Brain')
  })

  test('shows warning when charts are too dense', async () => {
    const features = new Map(
      Array.from({ length: 10 }, (_, i) => {
        const f = createFeature(`f${i}`, 100 + i * 5, 110 + i * 5, {
          Brain: [1, 2, 3],
        })
        return [f.id(), f]
      }),
    )

    const { findByText } = render(
      <FeatureChartPlotlyRendering
        features={features}
        regions={[
          {
            refName: 'chr1',
            start: 0,
            end: 200,
            assemblyName: 'hg38',
          },
        ]}
        bpPerPx={1}
        width={200}
        height={180}
        blockKey="block-2"
        displayModel={mockDisplayModel}
        config={config}
      />,
    )

    expect(
      await findByText('Too many charts — zoom in to view individual charts'),
    ).toBeTruthy()
    expect(mockNewPlot).not.toHaveBeenCalled()
  })

  test('a named built-in drawer decides the chart, not plotType', async () => {
    // Pre-WP4 this rendered a box (plotType default) ignoring the drawer.
    renderWith(
      {
        ...config,
        drawer: 'barPlot',
        plotType: 'box',
      } as unknown as AnyConfigurationModel,
      {
        bars: [
          { name: 'Brain', value: 3 },
          { name: 'Liver', value: 5 },
        ],
      },
    )

    await waitFor(() => {
      expect(mockNewPlot).toHaveBeenCalledTimes(1)
    })
    const traces = mockNewPlot.mock.calls[0]![1] as {
      type: string
      x: string[]
      y: number[]
    }[]
    expect(traces[0]!.type).toBe('bar')
    expect(traces[0]!.x).toEqual(['Brain', 'Liver'])
    expect(traces[0]!.y).toEqual([3, 5])
  })

  test('drawer: "spec" is rendered here now (no "unsupported" panel)', async () => {
    renderWith(
      {
        ...config,
        drawer: 'spec',
        spec: {
          specVersion: 1,
          kind: 'box',
          data: { form: 'grouped-values', path: 'tissues' },
          axes: { yLabel: 'TPM' },
        },
      } as unknown as AnyConfigurationModel,
      { tissues: { Brain: [1, 2, 3, 4] } },
    )

    await waitFor(() => {
      expect(mockNewPlot).toHaveBeenCalledTimes(1)
    })
    const [, traces, layout] = mockNewPlot.mock.calls[0]!
    expect((traces as { type: string }[])[0]!.type).toBe('box')
    expect(
      (layout as { yaxis: { title: { text: string } } }).yaxis.title.text,
    ).toBe('TPM')
  })

  test('an invalid spec shows the validator message, not a blank chart', async () => {
    const { findByTestId } = renderWith(
      {
        ...config,
        drawer: 'spec',
        spec: { specVersion: 1, kind: 'violin', data: { form: 'values' } },
      } as unknown as AnyConfigurationModel,
      {},
    )
    const notice = await findByTestId('feature-chart-plotly-spec-error')
    expect(notice.textContent).toContain('spec.data.form')
    expect(mockNewPlot).not.toHaveBeenCalled()
  })

  test('an unknown drawer shows the drawer error, not a blank chart', async () => {
    const { findByTestId } = renderWith(
      { ...config, drawer: 'nope' } as unknown as AnyConfigurationModel,
      {},
    )
    const notice = await findByTestId('feature-chart-plotly-drawer-error')
    expect(notice.textContent).toContain('Unknown FeatureChart drawer')
  })

  test('a plugin drawer without a model says it is canvas-only', async () => {
    registerFeatureChartDrawer('testPlugin/selfPainted', () => {})
    const { findByText } = renderWith(
      {
        ...config,
        drawer: 'testPlugin/selfPainted',
      } as unknown as AnyConfigurationModel,
      {},
    )
    expect(await findByText(/canvas-only/)).toBeTruthy()
    expect(mockNewPlot).not.toHaveBeenCalled()
  })

  test('the legacy plotType path warns once and still draws', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const { unmount } = renderWith(config, { Brain: [1, 2, 3] })
    await waitFor(() => {
      expect(mockNewPlot).toHaveBeenCalledTimes(1)
    })
    expect(
      warn.mock.calls.some(call =>
        String(call[0]).includes('plotType "box" is deprecated'),
      ),
    ).toBe(true)
    unmount()
    warn.mockRestore()
  })
})
