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

    const canvas = (await screen.findByTestId(
      'feature-chart-maximize-canvas',
    ))
    const dpr = window.devicePixelRatio || 1
    // regression: the canvas kept its 300x150 default because the drawing effect
    // ran before MUI had mounted the dialog content
    expect(canvas.width).toBe(640 * dpr)
    expect(canvas.height).toBe(320 * dpr)
  })
})
