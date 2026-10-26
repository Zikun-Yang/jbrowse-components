import { act, fireEvent, screen, waitFor } from '@testing-library/react'

import {
  createView,
  doBeforeEach,
  expectCanvasMatch,
  hts,
  setup,
} from './util.tsx'

setup()

beforeEach(() => {
  doBeforeEach()
})

const delay = { timeout: 60000 }
const opts = [{}, delay]

test('open a multibigwig xyplot track', async () => {
  const { view, findAllByTestId, findByTestId } = await createView()
  view.setNewView(5, 0)
  fireEvent.click(await findByTestId(hts('volvox_microarray_multi'), ...opts))
  expectCanvasMatch((await findAllByTestId(/prerendered_canvas/, ...opts))[0]!)
}, 60000)

test('open a multibigwig multirowxy track', async () => {
  const { view, findAllByTestId, findByTestId } = await createView()
  view.setNewView(5, 0)
  fireEvent.click(
    await findByTestId(hts('volvox_microarray_multi_multirowxy'), ...opts),
  )
  expectCanvasMatch((await findAllByTestId(/prerendered_canvas/, ...opts))[0]!)
}, 60000)

test('open a multibigwig multirowdensity track', async () => {
  const { view, findAllByTestId, findByTestId } = await createView()
  view.setNewView(5, 0)
  fireEvent.click(
    await findByTestId(hts('volvox_microarray_multi_multirowdensity'), ...opts),
  )
  expectCanvasMatch((await findAllByTestId(/prerendered_canvas/, ...opts))[0]!)
}, 60000)

test('open a multibigwig multiline track', async () => {
  const { view, findAllByTestId, findByTestId } = await createView()
  view.setNewView(5, 0)
  fireEvent.click(await findByTestId(hts('mytrack'), ...opts))
  expectCanvasMatch((await findAllByTestId(/prerendered_canvas/, ...opts))[0]!)
}, 60000)

test('open a multibigwig multirowline track', async () => {
  const { view, findAllByTestId, findByTestId } = await createView()
  view.setNewView(5, 0)
  fireEvent.click(
    await findByTestId(hts('volvox_microarray_multi_multirowline'), ...opts),
  )
  expectCanvasMatch((await findAllByTestId(/prerendered_canvas/, ...opts))[0]!)
}, 60000)

test('draws multi-row samples with the single wiggle default color', async () => {
  const { view, findByTestId } = await createView()
  view.setNewView(5, 0)
  fireEvent.click(
    await findByTestId(hts('volvox_microarray_multi_multirowxy'), ...opts),
  )
  const display = () =>
    view.tracks.at(-1)!.displays[0] as unknown as {
      sources?: { color?: string }[]
    }

  // a multi-row wiggle draws one sample per row, so it uses the color a
  // single-sample wiggle uses for positive scores instead of the hardcoded
  // blue it used before
  await waitFor(() => {
    expect(display().sources?.map(s => s.color)).toEqual(['#292421', '#292421'])
  }, delay)
}, 60000)

test('keeps one color per sample for an overlaid multi-wiggle', async () => {
  const { view, findByTestId } = await createView()
  view.setNewView(5, 0)
  fireEvent.click(await findByTestId(hts('volvox_microarray_multi'), ...opts))
  const display = () =>
    view.tracks.at(-1)!.displays[0] as unknown as {
      sources?: { color?: string }[]
      setRendererType: (arg: string) => void
    }

  await waitFor(() => {
    expect(display().sources?.length).toBe(4)
  }, delay)

  // the rows of the overlaid renderers are drawn into the same canvas, so
  // they still need a color each
  act(() => {
    display().setRendererType('xyplot')
  })
  await waitFor(() => {
    const colors = display().sources?.map(s => s.color) ?? []
    expect(colors).toHaveLength(4)
    expect(new Set(colors).size).toBe(4)
  }, delay)
}, 60000)

test('positions the multi-row y-scale bars with the y-axis left padding setting', async () => {
  const { view, session, findByTestId } = await createView()
  view.setNewView(5, 0)
  fireEvent.click(
    await findByTestId(hts('volvox_microarray_multi_multirowxy'), ...opts),
  )
  const settings = session as unknown as {
    setYScaleBarLeftPadding: (n: number) => void
  }

  // every row draws its own scale bar, and they used to be pinned to x=0
  // because only the full height multi-wiggle branch read the setting
  await screen.findByTestId('multirow-y-scale-bar-0', ...opts)
  expect(
    screen.getByTestId('multirow-y-scale-bar-0').getAttribute('transform'),
  ).toBe('translate(10 0)')

  act(() => {
    settings.setYScaleBarLeftPadding(30)
  })
  await waitFor(() => {
    expect(
      screen.getByTestId('multirow-y-scale-bar-0').getAttribute('transform'),
    ).toBe('translate(30 0)')
  }, delay)

  // the row labels follow the scale bar, so they clear its tick labels:
  // 30px padding + 50px reserved for the tick labels + 2px after the (absent)
  // color box
  expect(screen.getByText('k1').getAttribute('x')).toBe('82')

  // the setting is persisted in localStorage, so leave it at the default for
  // the tests that run after this one
  act(() => {
    settings.setYScaleBarLeftPadding(10)
  })
}, 60000)
