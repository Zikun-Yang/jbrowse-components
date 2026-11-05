import { render, waitFor } from '@testing-library/react'

import PlotlyPlot from './PlotlyPlot.tsx'

const mockNewPlot = jest.fn().mockResolvedValue(undefined)
const mockPurge = jest.fn()

jest.mock('plotly.js-dist-min', () => ({
  __esModule: true,
  default: {
    newPlot: (...args: unknown[]) => mockNewPlot(...args),
    purge: (...args: unknown[]) => mockPurge(...args),
  },
}))

const traces = [{ type: 'box', name: 'Brain' }] as never
const layout = { width: 400, height: 300 }

describe('PlotlyPlot teardown', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  /**
   * Regression: `plotly.js-dist-min` returns `undefined` from `purge()`, so the
   * old `plotly.purge(node).catch(...)` threw `purge(...).catch is not a
   * function` inside the effect cleanup. React reports that as a render error in
   * the *track*, which is how it was found: open the dialog's Interactive view,
   * close it, and the chart behind it was replaced by a TypeError.
   */
  test('closing the plot does not throw when purge() returns undefined', async () => {
    mockPurge.mockReturnValue(undefined)

    const onPlotReady = jest.fn()
    const { unmount } = render(
      <PlotlyPlot traces={traces} layout={layout} onPlotReady={onPlotReady} />,
    )
    await waitFor(() => {
      expect(mockNewPlot).toHaveBeenCalledTimes(1)
    })

    expect(() => {
      unmount()
    }).not.toThrow()
    expect(mockPurge).toHaveBeenCalledTimes(1)
  })

  test('a rejected purge promise does not reach the track either', async () => {
    mockPurge.mockImplementation(() => Promise.reject(new Error('detached node')))

    const { unmount } = render(<PlotlyPlot traces={traces} layout={layout} />)
    await waitFor(() => {
      expect(mockNewPlot).toHaveBeenCalledTimes(1)
    })

    expect(() => {
      unmount()
    }).not.toThrow()
    // give the rejection a microtask turn to become an unhandled rejection
    await Promise.resolve()
  })

  test('a synchronous purge throw is swallowed', async () => {
    mockPurge.mockImplementation(() => {
      throw new Error('detached node')
    })

    const { unmount } = render(<PlotlyPlot traces={traces} layout={layout} />)
    await waitFor(() => {
      expect(mockNewPlot).toHaveBeenCalledTimes(1)
    })

    expect(() => {
      unmount()
    }).not.toThrow()
  })
})
