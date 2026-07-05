import { fireEvent, waitFor } from '@testing-library/react'

import { doBeforeEach, doSetupForImportForm, setup } from './util.tsx'

setup()

beforeEach(() => {
  doBeforeEach()
})

const delay = { timeout: 20000 }

async function selectAssembly(
  findByTestId: (id: string) => Promise<HTMLElement>,
  findByRole: (
    role: string,
    options?: { name?: string },
  ) => Promise<HTMLElement>,
  name: string,
) {
  const input = (await findByTestId('assembly-selector')) as HTMLInputElement
  fireEvent.focus(input)
  fireEvent.keyDown(input, { key: 'ArrowDown' })
  fireEvent.click(await findByRole('option', { name }))
}

test('nav to volvox2', async () => {
  const { findByTestId, findByRole, findByText, getInputValue } =
    await doSetupForImportForm()
  await selectAssembly(findByTestId, findByRole, 'volvox2')
  await waitFor(() => {
    expect(getInputValue()).toBe('ctgA')
  })
  fireEvent.click(await findByText('Open'))
  await waitFor(() => {
    expect(getInputValue()).toBe('ctgA:1..50,001')
  }, delay)
}, 30000)

test('select volvox404', async () => {
  const { findByTestId, findByRole, findByText } = await doSetupForImportForm()
  await selectAssembly(findByTestId, findByRole, 'volvox404')
  await findByText(/HTTP 404/)
}, 30000)

test('select misc', async () => {
  const { findByTestId, findByRole, findByText, getInputValue } =
    await doSetupForImportForm()
  await selectAssembly(findByTestId, findByRole, 'misc')
  await waitFor(() => {
    expect(getInputValue()).toBe('t1')
  }, delay)
}, 30000)
