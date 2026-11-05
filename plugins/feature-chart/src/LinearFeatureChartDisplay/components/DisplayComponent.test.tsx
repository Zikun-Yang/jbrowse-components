import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import DisplayComponent from './DisplayComponent.tsx'
import { initBuiltInDrawers } from '../../FeatureChartDrawer/drawerRegistry.ts'

import type { LinearFeatureChartDisplayModel } from '../model.ts'

jest.mock('@jbrowse/plugin-linear-genome-view', () => ({
  // the display chrome around the charts is not what this test is about
  BaseLinearDisplayComponent: () => null,
}))

jest.mock('@jbrowse/core/configuration', () => ({
  getConf: (_model: unknown, path: string[]) =>
    path[path.length - 1] === 'drawer' ? 'barPlot' : undefined,
  readConfObject: () => undefined,
}))

const mockView = {
  id: 'lgv',
  width: 800,
  bpPerPx: 1,
  assemblyNames: ['volvox'],
  dynamicBlocks: {
    contentBlocks: [
      { refName: 'ctgA', start: 0, end: 1000, assemblyName: 'volvox' },
    ],
  },
  navToLocString: jest.fn(),
}

jest.mock('@jbrowse/core/util', () => ({
  getContainingView: () => mockView,
  getContainingTrack: () => ({ trackId: 'fc_track' }),
  getEnv: () => ({ pluginManager: undefined }),
  getSession: () => ({ theme: {} }),
}))

jest.mock('react-markdown', () => ({
  __esModule: true,
  default: ({ children }: { children: string }) => children,
}))

jest.mock('plotly.js-dist-min', () => ({
  __esModule: true,
  default: { newPlot: jest.fn(), purge: jest.fn(), relayout: jest.fn() },
}))

/** jsdom has no 2D context; the dialog only needs the canvas to exist. */
function stubCanvas() {
  const ctx = new Proxy({} as Record<string, unknown>, {
    get: (target, property) =>
      property in target ? target[property as string] : () => {},
    set: (target, property, value) => {
      target[property as string] = value
      return true
    },
  })
  jest
    .spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockImplementation((() => ctx) as never)
}

function fakeFeature(start: number, end: number, name: string) {
  return {
    id: () => name,
    get: (key: string) =>
      key === 'start'
        ? start
        : key === 'end'
          ? end
          : key === 'refName'
            ? 'ctgA'
            : key === 'name'
              ? name
              : undefined,
  }
}

function fakeModel(feature: ReturnType<typeof fakeFeature>, height = 180) {
  return {
    id: 'display-fc_track-LinearFeatureChartDisplay',
    height,
    rendererConfig: {},
    features: new Map([['fc1', feature]]),
    featureUnderMouse: undefined,
    setFeatureIdUnderMouse: jest.fn(),
  } as unknown as LinearFeatureChartDisplayModel
}

beforeEach(() => {
  initBuiltInDrawers()
  stubCanvas()
})

describe('DisplayComponent maximize dialog', () => {
  test('the dialog keeps its chart after the pointer leaves the track', () => {
    // the bug: opening the dialog and moving the mouse towards its buttons
    // cleared the hover state, which emptied the dialog (the chart vanished and
    // the dialog shrank under the pointer, so the click landed on the backdrop)
    const feature = fakeFeature(200, 300, 'fc1')
    render(<DisplayComponent model={fakeModel(feature)} />)

    const display = screen.getByTestId('feature-chart-display')
    fireEvent.mouseMove(display, { clientX: 250, clientY: 10 })

    const icon = screen.getByTestId('feature-chart-maximize')
    fireEvent.click(icon)

    expect(screen.getByTestId('feature-chart-view-toggle')).toBeTruthy()
    expect(screen.getByTestId('feature-chart-maximize-canvas')).toBeTruthy()

    // the pointer leaves the track on its way to Export PNG
    fireEvent.mouseLeave(display)

    expect(screen.getByTestId('feature-chart-maximize-canvas')).toBeTruthy()
    expect(screen.getByTestId('feature-chart-view-toggle')).toBeTruthy()
    expect(screen.getByTestId('feature-chart-export-png')).toBeTruthy()
  })

  test('closing the dialog releases the snapshot', async () => {
    const feature = fakeFeature(200, 300, 'fc1')
    render(<DisplayComponent model={fakeModel(feature)} />)

    const display = screen.getByTestId('feature-chart-display')
    fireEvent.mouseMove(display, { clientX: 250, clientY: 10 })
    fireEvent.click(screen.getByTestId('feature-chart-maximize'))

    fireEvent.click(screen.getByText('Close'))

    await waitFor(() => {
      expect(screen.queryByTestId('feature-chart-view-toggle')).toBeNull()
    })
    // the icon is still reachable with the pointer back over the chart
    expect(screen.getByTestId('feature-chart-maximize')).toBeTruthy()
  })
})
