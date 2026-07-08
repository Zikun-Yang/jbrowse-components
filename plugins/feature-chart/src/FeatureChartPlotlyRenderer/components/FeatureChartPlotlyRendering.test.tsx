import { SimpleFeature } from '@jbrowse/core/util'
import { render, waitFor } from '@testing-library/react'

import FeatureChartPlotlyRendering from './FeatureChartPlotlyRendering.tsx'

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
} as unknown as import('@jbrowse/plugin-linear-genome-view').BaseLinearDisplayModel

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
} as unknown as import('@jbrowse/core/configuration').AnyConfigurationModel

describe('FeatureChartPlotlyRendering', () => {
  beforeEach(() => {
    jest.clearAllMocks()
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
})
