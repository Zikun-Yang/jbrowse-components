import { fireEvent, screen, waitFor } from '@testing-library/react'

import { createView, doBeforeEach, hts, pv, setup } from './util.tsx'

setup()

beforeEach(() => {
  doBeforeEach()
})

const delay = { timeout: 30000 }
const opts = [{}, delay]

/**
 * End-to-end check of the color legend wiring: the renderer reports the data
 * it colored from inside the worker, the block carries it to the display, and
 * the display turns it into legend rows shown over the track.
 */
test('feature track color legend follows the renderer color data', async () => {
  const { view, findByTestId } = await createView()
  view.setNewView(5, 0)

  fireEvent.click(await findByTestId(hts('bed_genes'), ...opts))
  await findByTestId(pv('1..4000-0'), ...opts)

  const display = view.tracks[0]!.displays[0]! as unknown as {
    colorScheme: string
    legendItems: () => { label: string }[]
    setColorScheme: (scheme: string) => void
    setShowLegend: (arg: boolean) => void
  }

  // no legend for config colors
  expect(display.colorScheme).toBe('default')
  expect(display.legendItems()).toEqual([])

  display.setColorScheme('type')
  await waitFor(() => {
    expect(display.legendItems().length).toBeGreaterThan(0)
  }, delay)
  const labels = display.legendItems().map(item => item.label)
  expect(labels.length).toBeGreaterThan(0)

  display.setShowLegend(true)
  await screen.findByText(labels[0]!, {}, delay)

  // the score range in the legend is the one the renderer mapped onto
  display.setColorScheme('score')
  await waitFor(() => {
    expect(display.legendItems()).toHaveLength(5)
  }, delay)
  // every feature in this BED12 file has score 1000
  expect(display.legendItems().map(item => item.label)).toEqual([
    '1000',
    '1000',
    '1000',
    '1000',
    '1000',
  ])
}, 60000)
