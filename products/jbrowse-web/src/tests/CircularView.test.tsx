import '@testing-library/jest-dom'
import { fireEvent, waitFor } from '@testing-library/react'

import {
  createView,
  doBeforeEach,
  hts,
  selectAssembly,
  setup,
} from './util.tsx'
import configSnapshot from '../../test_data/volvox/config.json' with { type: 'json' }

setup()

beforeEach(() => {
  doBeforeEach()
})

const delay = { timeout: 10000 }
const opts = [{}, delay]

test('open a circular view', async () => {
  const { findByTestId, findByRole, findByText, queryByTestId } =
    await createView({
      ...configSnapshot,
      defaultSession: {
        name: 'Integration Test Circular',
        views: [{ id: 'integration_test_circular', type: 'CircularView' }],
      },
    })
  const assemblyInput = (await findByTestId(
    'assembly-selector',
  )) as HTMLInputElement
  await selectAssembly(findByRole, assemblyInput, 'volvox')
  const openButton = await findByText('Open')
  await waitFor(() => {
    expect(openButton.closest('button')).not.toBeDisabled()
  })
  fireEvent.click(await findByText('File', ...opts))
  fireEvent.click(await findByText(/Open track/, ...opts))
  fireEvent.click(await findByText('Open', ...opts))
  fireEvent.click(await findByTestId('circular_track_select'))
  fireEvent.click(await findByTestId(hts('volvox_sv_test'), {}, delay))
  await findByTestId('structuralVariantChordRenderer', {}, delay)
  await findByTestId('chord-test-vcf-66511')
  fireEvent.click(await findByTestId(hts('volvox_sv_test'), {}, delay))
  await waitFor(() => {
    expect(
      queryByTestId('structuralVariantChordRenderer'),
    ).not.toBeInTheDocument()
  })

  fireEvent.click(await findByTestId(hts('volvox_sv_test_renamed'), {}, delay))

  // make sure a chord is rendered
  await findByTestId('chord-test-vcf-63101', {}, delay)
}, 25000)
