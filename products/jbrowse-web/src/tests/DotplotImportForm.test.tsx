import { fireEvent } from '@testing-library/react'

import { createView, doBeforeEach, expectCanvasMatch, setup } from './util.tsx'
setup()

jest.mock('../makeWorkerInstance', () => () => {})

const delay = { timeout: 50000 }
beforeEach(() => {
  doBeforeEach()
})

// onAction listener warning
console.warn = jest.fn()

test('open tracklist file', async () => {
  const { session, findByTestId, findByRole, findAllByTestId, findByText } =
    await createView()

  fireEvent.click(await findByText('File'))
  fireEvent.click(await findByText('Add'))
  fireEvent.click(await findByText('Dotplot view'))
  expect(session.views.length).toBe(2)
  const assemblyInputs = await findAllByTestId('assembly-selector')

  expect(assemblyInputs.length).toBe(2)

  const input = assemblyInputs[1]! as HTMLInputElement
  fireEvent.focus(input)
  fireEvent.keyDown(input, { key: 'ArrowDown' })
  fireEvent.click(await findByRole('option', { name: 'volvox_del' }))

  fireEvent.click(await findByText('Launch'))

  expectCanvasMatch(await findByTestId('prerendered_canvas_done', {}, delay))
}, 50000)

test('open local paf', async () => {
  const { session, findByTestId, findByRole, findAllByTestId, findByText } =
    await createView()

  fireEvent.click(await findByText('File'))
  fireEvent.click(await findByText('Add'))
  fireEvent.click(await findByText('Dotplot view'))
  expect(session.views.length).toBe(2)

  const assemblyInputs = await findAllByTestId('assembly-selector')
  const input = assemblyInputs[0]! as HTMLInputElement
  fireEvent.focus(input)
  fireEvent.keyDown(input, { key: 'ArrowDown' })
  fireEvent.click(await findByRole('option', { name: 'volvox_del' }))

  fireEvent.click(await findByText('New track'))
  fireEvent.click(await findByText('.paf'))
  fireEvent.change(await findByTestId('urlInput'), {
    target: {
      value: 'volvox_del.paf',
    },
  })

  fireEvent.click(await findByText('Swap?'))
  fireEvent.click(await findByText('Launch'))
  expectCanvasMatch(await findByTestId('prerendered_canvas_done', {}, delay))
}, 50000)

test('open local pif', async () => {
  const { session, findByTestId, findByRole, findAllByTestId, findByText } =
    await createView()

  fireEvent.click(await findByText('File'))
  fireEvent.click(await findByText('Add'))
  fireEvent.click(await findByText('Dotplot view'))
  expect(session.views.length).toBe(2)

  const assemblyInputs = await findAllByTestId('assembly-selector')
  const input = assemblyInputs[0]! as HTMLInputElement
  fireEvent.focus(input)
  fireEvent.keyDown(input, { key: 'ArrowDown' })
  fireEvent.click(await findByRole('option', { name: 'volvox_del' }))

  fireEvent.click(await findByText('New track'))
  fireEvent.click(await findByText('.pif.gz'))

  const inputs = await findAllByTestId('urlInput')
  fireEvent.change(inputs[0]!, {
    target: {
      value: 'volvox_del.pif.gz',
    },
  })
  fireEvent.change(inputs[1]!, {
    target: {
      value: 'volvox_del.pif.gz.tbi',
    },
  })

  fireEvent.click(await findByText('Swap?'))
  fireEvent.click(await findByText('Launch'))
  expectCanvasMatch(await findByTestId('prerendered_canvas_done', {}, delay))
}, 50000)
