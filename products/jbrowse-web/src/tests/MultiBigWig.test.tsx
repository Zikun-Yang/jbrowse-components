import { applySnapshot, getSnapshot } from '@jbrowse/mobx-state-tree'
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
      sources?: { color?: string; colorIsDefault?: boolean }[]
    }

  // a multi-row wiggle draws one sample per row, so it uses the color a
  // single-sample wiggle uses for positive scores instead of the hardcoded
  // blue it used before. the derived color is marked as such, so the renderers
  // can still switch to the bicolor pos/neg callback for negative scores
  await waitFor(() => {
    expect(display().sources?.map(s => s.color)).toEqual(['#292421', '#292421'])
    expect(display().sources?.map(s => s.colorIsDefault)).toEqual([true, true])
  }, delay)
}, 60000)

test('keeps one color per sample for an overlaid multi-wiggle', async () => {
  const { view, findByTestId } = await createView()
  view.setNewView(5, 0)
  fireEvent.click(await findByTestId(hts('volvox_microarray_multi'), ...opts))
  const display = () =>
    view.tracks.at(-1)!.displays[0] as unknown as {
      sources?: { color?: string; name: string; source: string }[]
      setLayout: (layout: { name: string; source: string }[]) => void
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

  // a layout only stores order/group here (no colors). the overlaid renderers
  // have to keep a palette color per sample instead of falling back to one
  // shared color for the whole canvas
  act(() => {
    display().setLayout(
      display().sources!.map(s => ({ name: s.name, source: s.source })),
    )
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

test('keeps the multi-row y-scale tick labels inside each row', async () => {
  const { view, findByTestId } = await createView()
  view.setNewView(5, 0)
  fireEvent.click(
    await findByTestId(hts('volvox_microarray_multi_multirowxy'), ...opts),
  )
  const display = () =>
    view.tracks.at(-1)!.displays[0] as unknown as {
      rowHeight: number
      renderProps: () => { offset?: number }
    }

  const bar = await screen.findByTestId('multirow-y-scale-bar-0', ...opts)
  const tickYs = [...bar.querySelectorAll('text')].map(text => {
    const transform = text.parentElement?.getAttribute('transform') ?? ''
    return Number(/translate\(0,([\d.]+)\)/.exec(transform)?.[1])
  })
  const { offset } = display().renderProps()

  expect(tickYs.length).toBeGreaterThan(1)
  // the top and bottom tick labels used to be centered on the row edges
  // (offset 0), where the top and bottom of the track cut them in half. the
  // data is drawn with the same inset, so the labels still line up with it
  expect(offset).toBe(5)
  expect(Math.min(...tickYs)).toBeGreaterThanOrEqual(5 - 0.5)
  expect(Math.max(...tickYs)).toBeLessThanOrEqual(display().rowHeight - 5 + 0.5)
}, 60000)

test('draws no background rectangle behind the multi-row legend', async () => {
  const { view, findByTestId } = await createView()
  view.setNewView(5, 0)
  fireEvent.click(
    await findByTestId(hts('volvox_microarray_multi_multirowxy'), ...opts),
  )

  const bar = await screen.findByTestId('multirow-y-scale-bar-0', ...opts)
  const legendSvg = bar.closest('svg')!

  // the white translucent rectangle behind every row label covered the track
  // data and was removed. the color swatch of the multi-row line/xy renderers
  // is drawn inside the canvas, not here
  expect(legendSvg.querySelectorAll('rect')).toHaveLength(0)
}, 60000)

test('reloads a multi-row layout that stored the legacy blue row color', async () => {
  const { view, findByTestId } = await createView()
  view.setNewView(5, 0)
  fireEvent.click(
    await findByTestId(hts('volvox_microarray_multi_multirowxy'), ...opts),
  )
  const display = () =>
    view.tracks.at(-1)!.displays[0] as unknown as {
      sources?: { color?: string; name: string; source: string }[]
      setLayout: (
        layout: { name: string; source: string; color: string }[],
      ) => void
    }

  await waitFor(() => {
    expect(display().sources?.length).toBe(2)
  }, delay)

  // a session saved while the multi-row renderers hardcoded blue stores it in
  // the layout as if the user had picked it, which is what kept a track blue
  // after the default changed
  act(() => {
    display().setLayout(
      display().sources!.map(s => ({
        name: s.name,
        source: s.source,
        color: 'blue',
      })),
    )
  })
  await waitFor(() => {
    expect(display().sources?.map(s => s.color)).toEqual(['blue', 'blue'])
  }, delay)

  // loading the display again (a page reload restores the session's layout)
  // has to drop the legacy default. a changed setting makes MST run the
  // snapshot through the model again instead of treating it as a no-op
  act(() => {
    const node = display() as unknown as Parameters<typeof applySnapshot>[0]
    applySnapshot(node, { ...getSnapshot(node), showSidebar: false })
  })
  await waitFor(() => {
    expect(display().sources?.map(s => s.color)).toEqual(['#292421', '#292421'])
  }, delay)
}, 60000)
