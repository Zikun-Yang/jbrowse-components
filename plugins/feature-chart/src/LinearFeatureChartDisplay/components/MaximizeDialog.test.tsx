import { render, screen } from '@testing-library/react'

import MaximizeDialog from './MaximizeDialog.tsx'
import { initBuiltInDrawers } from '../../FeatureChartDrawer/drawerRegistry.ts'

import type { LinearFeatureChartDisplayModel } from '../model.ts'
import type { Feature } from '@jbrowse/core/util'

const mockNavToLocString = jest.fn()

jest.mock('@jbrowse/core/configuration', () => ({
  getConf: jest.fn(),
}))

jest.mock('@jbrowse/core/util', () => ({
  // the catalog lives on the plugin manager, which the components read from the
  // MST environment; this fake display model has none
  getEnv: jest.fn(() => ({ pluginManager: undefined })),
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

const { getConf } = jest.requireMock('@jbrowse/core/configuration')

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
    const text = alert.textContent ?? ''
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
})
