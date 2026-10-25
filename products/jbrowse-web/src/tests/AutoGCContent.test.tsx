import '@testing-library/jest-dom'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'

import { createView, doBeforeEach, hts, openTrackMenu, setup } from './util.tsx'
import configSnapshot from '../../test_data/volvox/config.json' with { type: 'json' }

setup()

beforeEach(() => {
  doBeforeEach()
})

const delay = { timeout: 30000 }
const opts = [{}, delay]

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// the default volvox config sets an explicit GC window size; drop it so that
// this config behaves like an app config that leaves the window size to the
// view (the GC content display is re-added with its own defaults)
function configWithoutGCWindowSize() {
  const config = JSON.parse(JSON.stringify(configSnapshot))
  const { displays } = config.assemblies[0].sequence as {
    displays: { type: string }[]
  }
  config.assemblies[0].sequence.displays = displays.filter(
    d => d.type !== 'LinearGCContentDisplay',
  )
  return config
}

test('hands the track over to the GC content display when zoomed out, and back when zoomed in', async () => {
  const { view, findByTestId } = await createView()
  fireEvent.click(await findByTestId(hts('volvox_refseq'), ...opts))

  const display = () => view.tracks.at(-1)!.displays[0]!
  await waitFor(() => {
    expect(display().type).toBe('LinearReferenceSequenceDisplay')
  }, delay)

  // zoomed out past the point where bases can be rendered
  view.setNewView(10, 0)
  await waitFor(() => {
    expect(display().type).toBe('LinearGCContentDisplay')
  }, delay)

  // zoomed in far enough to render bases again
  view.setNewView(0.5, 0)
  await waitFor(() => {
    expect(display().type).toBe('LinearReferenceSequenceDisplay')
  }, delay)
}, 60000)

test('sizes the GC content windows from the view and shows them in the track label', async () => {
  const { view, findByTestId } = await createView(configWithoutGCWindowSize())
  fireEvent.click(await findByTestId(hts('volvox_refseq'), ...opts))

  const display = () => view.tracks.at(-1)!.displays[0]!
  view.setNewView(10, 0)
  await waitFor(() => {
    expect(display().type).toBe('LinearGCContentDisplay')
  }, delay)

  // one window per 2 screen pixels, so 20 bp per window at 10 bp/px
  expect(view.bpPerPx).toBe(10)
  await waitFor(() => {
    expect(display().windowSizeSetting).toBe(20)
  }, delay)
  await findByTestId('track-label-info', ...opts)
  await waitFor(() => {
    expect(screen.getByTestId('track-label-info').textContent).toBe(
      'Window size = 20bp, Step size = 20bp',
    )
  }, delay)

  // the window follows the zoom level
  view.setNewView(30, 0)
  await waitFor(() => {
    expect(display().windowSizeSetting).toBe(60)
  }, delay)
  await waitFor(() => {
    expect(screen.getByTestId('track-label-info').textContent).toBe(
      'Window size = 60bp, Step size = 60bp',
    )
  }, delay)

  // a manually set window size wins until it is reset
  act(() => {
    display().setGCContentParams({ windowSize: 500, windowDelta: 500 })
  })
  await waitFor(() => {
    expect(display().windowSizeSetting).toBe(500)
  }, delay)
  await waitFor(() => {
    expect(screen.getByTestId('track-label-info').textContent).toBe(
      'Window size = 500bp, Step size = 500bp',
    )
  }, delay)

  act(() => {
    display().resetGCContentParams()
  })
  await waitFor(() => {
    expect(display().windowSizeSetting).toBe(60)
  }, delay)
}, 60000)

test('shows the window size dialog from the track menu item "Window size"', async () => {
  const { view, findAllByTestId, findByTestId } = await createView(
    configWithoutGCWindowSize(),
  )
  fireEvent.click(await findByTestId(hts('volvox_refseq'), ...opts))

  const display = () => view.tracks.at(-1)!.displays[0]!
  view.setNewView(10, 0)
  await waitFor(() => {
    expect(display().type).toBe('LinearGCContentDisplay')
  }, delay)

  await openTrackMenu({ findAllByTestId }, 'volvox_refseq')
  fireEvent.click(await screen.findByText('Window size', ...opts))
  await screen.findByText('Size of sliding window (bp)', ...opts)
  await screen.findByText('Step size of sliding window (bp)', ...opts)
}, 60000)

test('positions the y-scale bar with the global y-axis left padding setting', async () => {
  const { view, session, findByTestId } = await createView(
    configWithoutGCWindowSize(),
  )
  fireEvent.click(await findByTestId(hts('volvox_refseq'), ...opts))

  const display = () => view.tracks.at(-1)!.displays[0]!
  view.setNewView(10, 0)
  await waitFor(() => {
    expect(display().type).toBe('LinearGCContentDisplay')
  }, delay)

  // 10px by default, and used by every y-scale bar in the app
  await screen.findByTestId('y-scale-bar', ...opts)
  await waitFor(() => {
    expect(screen.getByTestId('y-scale-bar').style.left).toBe('10px')
  }, delay)

  act(() => {
    ;(
      session as unknown as {
        setYScaleBarLeftPadding: (n: number) => void
      }
    ).setYScaleBarLeftPadding(40)
  })
  await waitFor(() => {
    expect(screen.getByTestId('y-scale-bar').style.left).toBe('40px')
  }, delay)
}, 60000)

test('keeps the y-scale bar next to the left edge with "overlapping" track labels', async () => {
  const { view, session, findByTestId } = await createView(
    configWithoutGCWindowSize(),
  )
  fireEvent.click(await findByTestId(hts('volvox_refseq'), ...opts))

  const display = () => view.tracks.at(-1)!.displays[0]!
  view.setNewView(10, 0)
  await waitFor(() => {
    expect(display().type).toBe('LinearGCContentDisplay')
  }, delay)

  const settings = session as unknown as {
    setYScaleBarLeftPadding: (n: number) => void
  }

  // the scale bar used to be pushed right by measureText(track name) + 100 px
  // whenever the view was in "overlapping" label mode (the default of the
  // LinearGenomeViewPlugin config), which buried the padding setting: nothing
  // is drawn over the track, the labels have their own row above it
  act(() => {
    settings.setYScaleBarLeftPadding(25)
    view.setTrackLabels('overlapping')
  })
  expect(view.trackLabels).toBe('overlapping')

  await screen.findByTestId('y-scale-bar', ...opts)
  await waitFor(() => {
    expect(screen.getByTestId('y-scale-bar').style.left).toBe('25px')
  }, delay)

  // the setting is persisted in localStorage, so leave it at the default for
  // the tests that run after this one
  act(() => {
    settings.setYScaleBarLeftPadding(10)
  })
}, 60000)

test('leaves a GC content display picked by hand alone', async () => {
  const { view, findAllByTestId, findByTestId, findByText } = await createView()
  fireEvent.click(await findByTestId(hts('volvox_refseq'), ...opts))

  const display = () => view.tracks.at(-1)!.displays[0]!
  await waitFor(() => {
    expect(display().type).toBe('LinearReferenceSequenceDisplay')
  }, delay)

  await openTrackMenu({ findAllByTestId }, 'volvox_refseq')
  fireEvent.click(await findByText('Display types', ...opts))
  fireEvent.click(await findByText('GC content display', ...opts))
  await waitFor(() => {
    expect(display().type).toBe('LinearGCContentDisplay')
  }, delay)

  // only a display that the sequence display swapped in itself switches back,
  // so this manual one is still here after the reaction delay
  await sleep(500)
  expect(display().type).toBe('LinearGCContentDisplay')
}, 60000)

test('does not offer an auto-switch toggle in the track menu', async () => {
  const { findAllByTestId, findByTestId } = await createView()
  fireEvent.click(await findByTestId(hts('volvox_refseq'), ...opts))
  await openTrackMenu({ findAllByTestId }, 'volvox_refseq')
  await screen.findByText('Show forward', ...opts)
  expect(screen.queryByText('Auto-switch to GC content')).toBeNull()
}, 60000)

test('sets the y-axis left padding from the settings page', async () => {
  const { session, findByLabelText } = await createView()
  const settings = session as unknown as {
    setActiveView: (arg: string) => void
    yScaleBarLeftPadding: number
    setYScaleBarLeftPadding: (n: number) => void
  }

  // the setting is persisted in localStorage, so start from a known value
  act(() => {
    settings.setYScaleBarLeftPadding(10)
    settings.setActiveView('settings')
  })

  const input = await findByLabelText('Y-axis left padding (px)', ...opts)
  expect((input as HTMLInputElement).value).toBe('10')

  fireEvent.change(input, { target: { value: '40' } })
  await waitFor(() => {
    expect(settings.yScaleBarLeftPadding).toBe(40)
  }, delay)
}, 60000)
