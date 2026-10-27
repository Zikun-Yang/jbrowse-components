import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import MaximizeDialog from './MaximizeDialog.tsx'
import { initBuiltInDrawers } from '../../FeatureChartDrawer/drawerRegistry.ts'

import type { LinearFeatureChartDisplayModel } from '../model.ts'
import type { Feature } from '@jbrowse/core/util'

const mockNavToLocString = jest.fn()

jest.mock('@jbrowse/core/configuration', () => ({
  getConf: jest.fn(),
  // MaximizePlotly resolves the renderer settings from the config model; the
  // fake config here is a plain object, so "unset" is the honest answer.
  readConfObject: jest.fn(() => undefined),
}))

jest.mock('@jbrowse/core/util', () => ({
  // the catalog lives on the plugin manager, which the components read from the
  // MST environment; this fake display model has none
  getEnv: jest.fn(() => ({ pluginManager: undefined })),
  getContainingTrack: jest.fn(() => ({ trackId: 'tissue_expression' })),
  getContainingView: jest.fn(() => ({
    assemblyNames: ['hg38'],
    dynamicBlocks: { contentBlocks: [] },
    navToLocString: mockNavToLocString,
  })),
  getSession: jest.fn(() => ({ theme: {} })),
}))

// Drawers never actually paint here: jsdom has no canvas 2d context.
// react-markdown is ESM-only; the dialog only needs to show the rendered text.
jest.mock('react-markdown', () => ({
  __esModule: true,
  default: ({ children }: { children: string }) => children,
}))

const mockNewPlot = jest.fn().mockResolvedValue(undefined)
const mockPurge = jest.fn().mockResolvedValue(undefined)
const mockRelayout = jest.fn().mockResolvedValue(undefined)
const mockToImage = jest
  .fn()
  .mockResolvedValue('data:image/png;base64,aGVsbG8gd29ybGQ=')

jest.mock('plotly.js-dist-min', () => ({
  __esModule: true,
  default: {
    newPlot: (...args: unknown[]) => mockNewPlot(...args),
    purge: (...args: unknown[]) => mockPurge(...args),
    relayout: (...args: unknown[]) => mockRelayout(...args),
    toImage: (...args: unknown[]) => mockToImage(...args),
  },
}))

const { getConf } = jest.requireMock('@jbrowse/core/configuration')

/**
 * jsdom has no 2D context. The dialog only needs the canvas to *exist and be
 * sized* for the layout tests, and to yield a PNG for the export tests, so a
 * recording context plus a fixed `toDataURL` is enough.
 */
function stubCanvas() {
  const ctx = new Proxy(
    { scale: () => {}, clearRect: () => {} } as Record<string, unknown>,
    {
      get: (target, property) =>
        property in target ? target[property as string] : () => {},
      set: (target, property, value) => {
        target[property as string] = value
        return true
      },
    },
  )
  jest
    .spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockImplementation((() => ctx) as never)
  jest
    .spyOn(HTMLCanvasElement.prototype, 'toDataURL')
    .mockImplementation(() => `data:image/png;base64,${'A'.repeat(4000)}`)
}

function createFeature(): Feature {
  const data: Record<string, unknown> = {
    refName: 'chr1',
    start: 100,
    end: 200,
    name: 'GENE1',
    contextData: {
      data: { tissues: { Brain: [1, 2, 3] } },
      name: 'GENE1',
      description: '**{{name}}** expression',
    },
  }
  return {
    id: () => 'f1',
    get: (key: string) => data[key],
    toJSON: () => data,
  } as unknown as Feature
}

const displayModel = {
  rendererConfig: {},
} as unknown as LinearFeatureChartDisplayModel

describe('MaximizeDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    initBuiltInDrawers()
  })

  test('explains an unknown drawer instead of showing an empty dialog', async () => {
    getConf.mockImplementation(() => 'tissueBoxPlot')

    render(
      <MaximizeDialog
        open
        onClose={() => {}}
        feature={createFeature()}
        displayModel={displayModel}
      />,
    )

    const alert = await screen.findByRole('alert')
    const text = alert.textContent
    expect(text).toContain('Unknown FeatureChart drawer "tissueBoxPlot"')
    expect(text).toContain('Available:')
    expect(text).toContain('precomputedBoxPlot')
    // the description is still useful even when the chart cannot be drawn
    expect(screen.getByText('**GENE1** expression')).toBeTruthy()
  })

  test('draws the chart without an alert when the drawer exists', () => {
    getConf.mockImplementation(() => 'rawBoxPlot')

    render(
      <MaximizeDialog
        open
        onClose={() => {}}
        feature={createFeature()}
        displayModel={displayModel}
      />,
    )

    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  test('sizes the maximize canvas before drawing', async () => {
    // the dialog reads two slots from the renderer config
    getConf.mockImplementation((_model: unknown, path: unknown) => {
      const key = Array.isArray(path) ? path.join('.') : String(path)
      return key.includes('colorScheme') ? 'tableau10' : 'precomputedBoxPlot'
    })

    render(
      <MaximizeDialog
        open
        onClose={() => {}}
        feature={createFeature()}
        displayModel={displayModel}
        chartWidth={640}
        chartHeight={320}
      />,
    )

    const canvas = await screen.findByTestId<HTMLCanvasElement>(
      'feature-chart-maximize-canvas',
    )
    const dpr = window.devicePixelRatio || 1
    // regression: the canvas kept its 300x150 default because the drawing effect
    // ran before MUI had mounted the dialog content
    expect(canvas.width).toBe(640 * dpr)
    expect(canvas.height).toBe(320 * dpr)
  })

  test('lists every problem of an invalid spec instead of rendering blanks', async () => {
    const spec = {
      specVersion: 1,
      kind: 'violin',
      data: { form: 'summary-stats', path: 'boxes' },
      style: { colorScheme: 'plasma' },
    }
    getConf.mockImplementation((_model: unknown, path: string[] | string) => {
      const key = Array.isArray(path) ? path[path.length - 1] : path
      if (key === 'drawer') {
        return 'spec'
      }
      if (key === 'spec') {
        return spec
      }
      return undefined
    })

    render(
      <MaximizeDialog
        open
        onClose={() => {}}
        feature={createFeature()}
        displayModel={displayModel}
      />,
    )

    const alert = await screen.findByTestId('feature-chart-spec-error')
    const text = alert.textContent
    // both the illegal combination and the unknown palette, not just the first
    expect(text).toContain('2 problems')
    expect(text).toContain('spec.data.form')
    expect(text).toContain('grouped-values')
    expect(text).toContain('spec.style.colorScheme')
    // the description keeps working while the chart cannot be drawn
    expect(screen.getByText('**GENE1** expression')).toBeTruthy()
  })

  test('a valid spec shows the canvas, not an alert', () => {
    const spec = {
      specVersion: 1,
      kind: 'box',
      data: { form: 'grouped-values', path: 'tissues' },
    }
    getConf.mockImplementation((_model: unknown, path: string[] | string) => {
      const key = Array.isArray(path) ? path[path.length - 1] : path
      if (key === 'drawer') {
        return 'spec'
      }
      if (key === 'spec') {
        return spec
      }
      return undefined
    })

    render(
      <MaximizeDialog
        open
        onClose={() => {}}
        feature={createFeature()}
        displayModel={displayModel}
      />,
    )

    expect(screen.getByTestId('feature-chart-maximize-canvas')).toBeTruthy()
    expect(screen.queryByTestId('feature-chart-spec-error')).toBeNull()
  })

  test('offers both views and keeps the static canvas as the default', async () => {
    stubCanvas()
    getConf.mockImplementation((_model: unknown, path: unknown) => {
      const key = Array.isArray(path) ? path.join('.') : String(path)
      return key.includes('colorScheme') ? 'tableau10' : 'precomputedBoxPlot'
    })

    render(
      <MaximizeDialog
        open
        onClose={() => {}}
        feature={createFeature()}
        displayModel={displayModel}
      />,
    )

    expect(screen.getByTestId('feature-chart-view-interactive')).toBeTruthy()
    expect(screen.getByTestId('feature-chart-view-static')).toBeTruthy()
    // default view is the pre-WP4 canvas: no Plotly chunk is pulled on open
    expect(
      await screen.findByTestId('feature-chart-maximize-canvas'),
    ).toBeTruthy()
    expect(mockNewPlot).not.toHaveBeenCalled()
  })

  test('exports a non-empty PNG from the static canvas', async () => {
    stubCanvas()
    getConf.mockImplementation((_model: unknown, path: unknown) => {
      const key = Array.isArray(path) ? path.join('.') : String(path)
      return key.includes('colorScheme') ? 'tableau10' : 'precomputedBoxPlot'
    })

    render(
      <MaximizeDialog
        open
        onClose={() => {}}
        feature={createFeature()}
        displayModel={displayModel}
        chartWidth={320}
        chartHeight={180}
      />,
    )

    await screen.findByTestId('feature-chart-maximize-canvas')
    fireEvent.click(screen.getByTestId('feature-chart-export-png'))

    const status = await screen.findByTestId('feature-chart-export-status')
    await waitFor(() => {
      expect(Number(status.dataset.bytes)).toBeGreaterThan(0)
    })
    expect(status.dataset.format).toBe('png')
    // trackId + feature name, exactly as the issue asks
    expect(status.dataset.filename).toBe('tissue_expression-GENE1-static.png')
  })

  test('exports a non-empty SVG from the static canvas', async () => {
    stubCanvas()
    getConf.mockImplementation((_model: unknown, path: unknown) => {
      const key = Array.isArray(path) ? path.join('.') : String(path)
      return key.includes('colorScheme') ? 'tableau10' : 'precomputedBoxPlot'
    })

    render(
      <MaximizeDialog
        open
        onClose={() => {}}
        feature={createFeature()}
        displayModel={displayModel}
        chartWidth={320}
        chartHeight={180}
      />,
    )

    await screen.findByTestId('feature-chart-maximize-canvas')
    fireEvent.click(screen.getByTestId('feature-chart-export-svg'))

    const status = await screen.findByTestId('feature-chart-export-status')
    await waitFor(() => {
      expect(Number(status.dataset.bytes)).toBeGreaterThan(0)
    })
    expect(status.dataset.format).toBe('svg')
    expect(status.dataset.filename).toBe('tissue_expression-GENE1-static.svg')
  })

  test('exports the interactive view through Plotly toImage', async () => {
    stubCanvas()
    getConf.mockImplementation((_model: unknown, path: unknown) => {
      const key = Array.isArray(path) ? path.join('.') : String(path)
      return key.includes('colorScheme') ? 'tableau10' : 'precomputedBoxPlot'
    })

    render(
      <MaximizeDialog
        open
        onClose={() => {}}
        feature={createFeature()}
        displayModel={displayModel}
        chartWidth={320}
        chartHeight={180}
      />,
    )

    fireEvent.click(screen.getByTestId('feature-chart-view-interactive'))
    expect(
      await screen.findByTestId('feature-chart-maximize-plotly'),
    ).toBeTruthy()
    await waitFor(() => {
      expect(mockNewPlot).toHaveBeenCalled()
    })

    fireEvent.click(screen.getByTestId('feature-chart-export-png'))
    const status = await screen.findByTestId('feature-chart-export-status')
    await waitFor(() => {
      expect(Number(status.dataset.bytes)).toBeGreaterThan(0)
    })
    expect(status.dataset.format).toBe('png')
    expect(status.dataset.filename).toBe(
      'tissue_expression-GENE1-interactive.png',
    )
    expect(mockToImage).toHaveBeenCalled()
    expect(mockRelayout).toHaveBeenCalledWith(expect.anything(), {
      width: 320,
      height: 180,
    })
  })
})
