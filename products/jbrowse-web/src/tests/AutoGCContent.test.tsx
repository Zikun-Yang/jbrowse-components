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

test('sizes the GC content windows from the view and shows the resolution', async () => {
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
  await findByTestId('gc-content-resolution', ...opts)
  await waitFor(() => {
    expect(screen.getByTestId('gc-content-resolution').textContent).toBe(
      'resolution: 20bp',
    )
  }, delay)

  // the resolution follows the zoom level
  view.setNewView(30, 0)
  await waitFor(() => {
    expect(display().windowSizeSetting).toBe(60)
  }, delay)
  await waitFor(() => {
    expect(screen.getByTestId('gc-content-resolution').textContent).toBe(
      'resolution: 60bp',
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
    expect(screen.getByTestId('gc-content-resolution').textContent).toBe(
      'resolution: 500bp',
    )
  }, delay)

  act(() => {
    display().resetGCContentParams()
  })
  await waitFor(() => {
    expect(display().windowSizeSetting).toBe(60)
  }, delay)
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
