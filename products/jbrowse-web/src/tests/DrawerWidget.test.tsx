import '@testing-library/jest-dom'

import { fireEvent, getByRole } from '@testing-library/react'

import { createView, doBeforeEach, hts } from './util.tsx'

const delay = { timeout: 15000 }

beforeEach(() => {
  doBeforeEach()
})

xtest('opens feature detail from left click', async () => {
  const { view, findByTestId, findAllByTestId } = await createView()
  view.setNewView(0.05, 5000)
  fireEvent.click(await findByTestId(hts('volvox_filtered_vcf'), {}, delay))

  view.tracks[0].displays[0].setFeatureIdUnderMouse('test-vcf-604453')
  fireEvent.click((await findAllByTestId('test-vcf-604453', {}, delay))[0]!)
  expect(
    await findByTestId('variant-side-drawer', {}, delay),
  ).toBeInTheDocument()
}, 40000)

test('widget drawer navigation', async () => {
  const { view, session, findByTestId, findAllByText } = await createView()
  view.setNewView(0.05, 5000)
  // opens a config editor widget
  fireEvent.click(await findByTestId(hts('volvox_filtered_vcf'), {}, delay))
  fireEvent.click(
    await findByTestId(
      'htsTrackEntryMenu-Tracks,volvox_filtered_vcf',
      {},
      delay,
    ),
  )
  fireEvent.click(
    (await findAllByText('Settings')).find(elt =>
      elt.closest('[role="menu"]'),
    )!,
  )
  await findByTestId('configEditor', {}, delay)

  // test minimize and maximize widget drawer
  // @ts-expect-error
  expect(session.minimized).toBeFalsy()

  await findByTestId('drawer-minimize')
  fireEvent.click(await findByTestId('drawer-minimize'))
  // @ts-expect-error
  expect(session.minimized).toBeTruthy()

  fireEvent.click(await findByTestId('drawer-maximize'))
  // @ts-expect-error
  expect(session.minimized).toBeFalsy()

  // track selector shows up in a modal dialog instead of the drawer
  fireEvent.mouseDown(
    getByRole(await findByTestId('widget-drawer-selects'), 'combobox'),
  )
  fireEvent.click(
    await findByTestId(
      'widget-drawer-selects-item-HierarchicalTrackSelectorWidget',
    ),
  )
  await findByTestId('hierarchical_track_selector')

  // closing the modal returns to the config editor in the drawer
  fireEvent.click(await findByTestId('modal-widget-close'))
  await findByTestId('configEditor', {}, delay)

  // test deleting widget from select dropdown using trash icon
  // @ts-expect-error
  expect(session.activeWidgets.size).toEqual(1)
  fireEvent.mouseDown(
    getByRole(await findByTestId('widget-drawer-selects'), 'combobox'),
  )
  fireEvent.click(await findByTestId('ConfigurationEditorWidget-drawer-delete'))
  // @ts-expect-error
  expect(session.activeWidgets.size).toEqual(0)
}, 40000)
