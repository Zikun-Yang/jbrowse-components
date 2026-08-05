import '@testing-library/jest-dom'
import { screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'

import { createView, doBeforeEach, hts, setup } from './util.tsx'

setup()

beforeEach(() => {
  doBeforeEach()
})

const delay = { timeout: 30000 }
const opts = [{}, delay]

interface AutoHeightSession {
  setAutoSizeTrackHeight: (arg: boolean) => void
  setMinAutoTrackHeight: (arg: number) => void
  setMaxAutoTrackHeight: (arg: number) => void
}

test('auto-size fits track height to content in both directions', async () => {
  const user = userEvent.setup()
  const { view, session } = await createView()
  const s = session as unknown as AutoHeightSession
  s.setAutoSizeTrackHeight(true)

  // dense region: track grows beyond the 100px default
  await view.navToLocString('ctgA:1..10,000')
  await user.click(await screen.findByTestId(hts('gff3tabix_genes'), ...opts))
  await screen.findAllByTestId(/prerendered_canvas.*done/, ...opts)

  const display = () => view.tracks.at(-1)!.displays[0]!
  await waitFor(() => {
    expect(display().height).toBeGreaterThan(100)
  }, delay)

  // sparse region: track shrinks back down towards the min
  await view.navToLocString('ctgB:1..6,079')
  await screen.findAllByTestId(/prerendered_canvas.*done/, ...opts)
  await waitFor(() => {
    expect(display().height).toBeLessThan(100)
  }, delay)

  // raising the min raises the floor even when content is tiny
  s.setMinAutoTrackHeight(250)
  await waitFor(() => {
    expect(display().height).toBe(250)
  }, delay)
}, 60000)

test('auto-size is capped by max auto track height for alignments tracks', async () => {
  const user = userEvent.setup()
  const { view, session } = await createView()
  const s = session as unknown as AutoHeightSession
  s.setAutoSizeTrackHeight(true)
  s.setMaxAutoTrackHeight(300)

  await view.navToLocString('ctgA:1..10,000')
  await user.click(await screen.findByTestId(hts('volvox_cram'), ...opts))
  await screen.findAllByTestId(/prerendered_canvas.*done/, ...opts)

  const display = () => view.tracks.at(-1)!.displays[0]!
  await waitFor(() => {
    // default config height is 250, so this proves it grew...
    expect(display().height).toBeGreaterThan(250)
    // ...but no further than the cap
    expect(display().height).toBeLessThanOrEqual(300)
  }, delay)
}, 60000)

test('tracks keep their default height when auto-size is off', async () => {
  const user = userEvent.setup()
  const { view } = await createView()

  await view.navToLocString('ctgA:1..10,000')
  await user.click(await screen.findByTestId(hts('gff3tabix_genes'), ...opts))
  await screen.findAllByTestId(/prerendered_canvas.*done/, ...opts)

  expect(view.tracks.at(-1)!.displays[0]!.height).toBe(100)
}, 60000)
