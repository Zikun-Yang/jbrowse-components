import '@testing-library/jest-dom'
import { fireEvent, screen, waitFor } from '@testing-library/react'

import { createView, doBeforeEach, hts, openTrackMenu, setup } from './util.tsx'

setup()

beforeEach(() => {
  doBeforeEach()
})

const delay = { timeout: 30000 }
const opts = [{}, delay]

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

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
