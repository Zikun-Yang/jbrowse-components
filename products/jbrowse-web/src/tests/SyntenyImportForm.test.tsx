import { fireEvent, waitFor, within } from '@testing-library/react'

import { createView, doBeforeEach, expectCanvasMatch, setup } from './util.tsx'
setup()

jest.mock('../makeWorkerInstance', () => () => {})

const delay = { timeout: 20000 }
beforeEach(() => {
  doBeforeEach()
})
afterEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

// onAction listener warning
console.warn = jest.fn()

test('open tracklist file', async () => {
  const { session, findByTestId, findByRole, findAllByTestId, findByText } =
    await createView()

  fireEvent.click(await findByText('File'))
  fireEvent.click(await findByText('Add'))
  fireEvent.click(await findByText('Linear synteny view'))
  expect(session.views.length).toBe(2)
  const assemblyInputs = await findAllByTestId('assembly-selector')
  expect(assemblyInputs.length).toBe(2)

  fireEvent.mouseDown(assemblyInputs[1]!)
  fireEvent.click(within(await findByRole('listbox')).getByText('volvox_del'))
  fireEvent.click(await findByText('Launch'))

  expectCanvasMatch(await findByTestId('synteny_canvas', {}, delay))
}, 40000)

test('three level', async () => {
  const {
    session,
    getAllByTestId,
    queryAllByTestId,
    findByRole,
    findAllByTestId,
    findByText,
  } = await createView()

  fireEvent.click(await findByText('File'))
  fireEvent.click(await findByText('Add'))
  fireEvent.click(await findByText('Linear synteny view'))
  expect(session.views.length).toBe(2)

  fireEvent.click(await findByText('Add row'))
  const assemblyInputs = await findAllByTestId('assembly-selector')

  expect(assemblyInputs.length).toBe(3)

  fireEvent.mouseDown(assemblyInputs[0]!)
  fireEvent.click(within(await findByRole('listbox')).getByText('volvox_ins'))

  fireEvent.mouseDown(assemblyInputs[2]!)
  fireEvent.click(within(await findByRole('listbox')).getByText('volvox_del'))

  const synbuttons = await findAllByTestId('synbutton')
  expect(synbuttons.length).toBe(2)
  fireEvent.click(synbuttons[1]!)

  fireEvent.click(await findByText('Launch'))
  await waitFor(() => {
    const canvases = queryAllByTestId('synteny_canvas')
    expect(canvases.length).toBe(2)
  }, delay)
  const canvases = getAllByTestId('synteny_canvas')
  expectCanvasMatch(canvases[0]!)
  expectCanvasMatch(canvases[1]!)
}, 40000)

test('open local paf', async () => {
  const { session, findByTestId, findByRole, findAllByTestId, findByText } =
    await createView()

  fireEvent.click(await findByText('File'))
  fireEvent.click(await findByText('Add'))
  fireEvent.click(await findByText('Linear synteny view'))
  expect(session.views.length).toBe(2)

  const assemblyInputs = await findAllByTestId('assembly-selector')
  fireEvent.mouseDown(assemblyInputs[0]!)
  fireEvent.click(within(await findByRole('listbox')).getByText('volvox_del'))

  const synbuttons = await findAllByTestId('synbutton')
  fireEvent.click(synbuttons[0]!)
  fireEvent.click(await findByText('New track'))

  fireEvent.change(await findByTestId('urlInput'), {
    target: {
      value: 'volvox_del.paf',
    },
  })

  fireEvent.click(await findByText('Launch'))
  expectCanvasMatch(await findByTestId('synteny_canvas', {}, delay))
}, 40000)

test('open local pif', async () => {
  const { session, findByTestId, findByRole, findAllByTestId, findByText } =
    await createView()

  fireEvent.click(await findByText('File'))
  fireEvent.click(await findByText('Add'))
  fireEvent.click(await findByText('Linear synteny view'))
  expect(session.views.length).toBe(2)

  const assemblyInputs = await findAllByTestId('assembly-selector')
  fireEvent.mouseDown(assemblyInputs[0]!)
  fireEvent.click(within(await findByRole('listbox')).getByText('volvox_del'))

  const synbuttons = await findAllByTestId('synbutton')
  fireEvent.click(synbuttons[0]!)
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

  fireEvent.click(await findByText('Launch'))
  expectCanvasMatch(await findByTestId('synteny_canvas', {}, delay))
}, 40000)
