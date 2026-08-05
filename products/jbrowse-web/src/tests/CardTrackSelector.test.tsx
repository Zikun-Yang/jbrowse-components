import { fireEvent, waitFor, within } from '@testing-library/react'

import { createView, doBeforeEach, setup } from './util.tsx'

setup()
beforeEach(() => {
  doBeforeEach()
})

const delay = { timeout: 40000 }

test('card track selector - toggle, active tracks, search, about dialog', async () => {
  const { view, findByTestId, findByText } = await createView(undefined, true)
  view.setNewView(0.05, 5000)

  const selector = await findByTestId('hierarchical_track_selector', {}, delay)

  // toggle a track on via its card checkbox
  fireEvent.click(
    await within(selector).findByTestId(
      'htsTrackEntry-Tracks,volvox_filtered_vcf',
      {},
      delay,
    ),
  )
  await waitFor(() => {
    expect(view.tracks.length).toBe(1)
  })

  // the track now appears in the Active tracks section
  await within(selector).findByTestId(
    'htsActiveTrack-volvox_filtered_vcf',
    {},
    delay,
  )

  // remove it again via the x button in Active tracks
  fireEvent.click(
    await within(selector).findByTestId(
      'htsActiveTrackRemove-volvox_filtered_vcf',
      {},
      delay,
    ),
  )
  await waitFor(() => {
    expect(view.tracks.length).toBe(0)
  })

  // search filters the track cards
  fireEvent.change(
    await within(selector).findByLabelText('Search tracks', {}, delay),
    { target: { value: 'filtered vcf' } },
  )
  await within(selector).findByText('volvox filtered vcf', {}, delay)
  await waitFor(() => {
    expect(
      within(selector).queryByTestId('htsTrackEntry-Tracks,volvox_microarray'),
    ).toBeNull()
  })

  // clicking a track name opens the About track dialog
  fireEvent.click(
    await within(selector).findByTestId(
      'htsTrackLabel-Tracks,volvox_filtered_vcf',
      {},
      delay,
    ),
  )
  await findByText('Configuration', {}, delay)
}, 60000)
