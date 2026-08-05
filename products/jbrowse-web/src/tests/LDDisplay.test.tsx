import { fireEvent, waitFor } from '@testing-library/react'

import {
  createView,
  doBeforeEach,
  expectCanvasMatch,
  hts,
  openTrackMenu,
  setup,
} from './util.tsx'

setup()

beforeEach(() => {
  doBeforeEach()
})

const timeout = 90_000
const delay = { timeout }

test(
  'opens LD heatmap display from track menu',
  async () => {
    const { view, findByTestId, findAllByTestId, findByText } =
      await createView()
    const opts = [{}, delay] as const

    await view.navToLocString('ctgA')
    fireEvent.click(await findByTestId(hts('volvox_test_vcf'), ...opts))

    await openTrackMenu({ findAllByTestId }, 'volvox_test_vcf', delay)
    fireEvent.click(await findByText('Display types', ...opts))
    fireEvent.click(await findByText('LD heatmap display', ...opts))
    await waitFor(() => {
      expect(view.tracks[0].displays[0].type).toBe('LDDisplay')
    }, delay)

    expectCanvasMatch(await findByTestId('ld_canvas_done', ...opts))
  },
  timeout,
)
