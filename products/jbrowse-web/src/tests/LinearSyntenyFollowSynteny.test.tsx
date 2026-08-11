import { waitFor } from '@testing-library/react'
import { LocalFile } from 'generic-filehandle2'
import { configure } from 'mobx'

import { handleRequest } from './generateReadBuffer.ts'
import { getPluginManager, setup } from './util.tsx'
import configSnapshot from '../../test_data/grape_peach_synteny/config.json' with { type: 'json' }

import type { LinearSyntenyViewModel } from '@jbrowse/plugin-linear-comparative-view'
import type { Feature } from '@jbrowse/core/util'

setup()

console.warn = jest.fn()
console.error = jest.fn()

configure({ disableErrorBoundaries: true })

const getFile = (url: string) => {
  const cleanUrl = url.replace(/http:\/\/localhost\//, '')
  const filePath = cleanUrl.startsWith('test_data')
    ? cleanUrl
    : `test_data/grape_peach_synteny/${cleanUrl}`
  return new LocalFile(require.resolve(`../../${filePath}`))
}

jest.mock('../makeWorkerInstance', () => () => {})

jest.spyOn(global, 'fetch').mockImplementation(async (url, args) => {
  return `${url}`.includes('jb2=true')
    ? new Response('{}')
    : handleRequest(() => getFile(`${url}`), args)
})

afterEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

interface LevelDisplay {
  type: string
  features?: Feature[]
}

function levelFeatures(view: LinearSyntenyViewModel, level: number) {
  return view.levels[level]!.tracks.flatMap(track =>
    (track.displays as LevelDisplay[]).flatMap(d =>
      d.type === 'LinearSyntenyDisplay' ? (d.features ?? []) : [],
    ),
  )
}

async function createFollowView() {
  const { rootModel } = getPluginManager(configSnapshot)
  rootModel.setDefaultSession()
  const session = rootModel.session!

  const view = session.addView('LinearSyntenyView', {
    init: {
      views: [
        { loc: 'Pp01:28,845,209..28,845,603', assembly: 'peach' },
        { loc: 'chr1:315,959..316,369', assembly: 'grape' },
      ],
      tracks: [['subset']],
    },
  }) as LinearSyntenyViewModel

  view.setWidth(800)

  await waitFor(() => expect(view.initialized).toBe(true), { timeout: 30000 })
  await waitFor(() => expect(levelFeatures(view, 0).length).toBe(1), {
    timeout: 30000,
  })
  view.setFollowSynteny(true)
  return view
}

// subset.paf has a single minus-strand alignment:
// peach Pp01:28,845,209-28,845,603 <-> grape chr1:315,959-316,369
test('follow synteny re-centers the other view after navigation', async () => {
  const view = await createFollowView()

  // navigate the peach view to the center of the aligned block; the grape
  // view should follow to the lifted-over position (minus strand, so the
  // peach center maps to the grape center 316,164)
  view.views[0]!.centerAt(28845406, 'Pp01')

  await waitFor(
    () => {
      const info = view.views[1]!.centerLineInfo
      expect(info?.refName).toBe('chr1')
      expect(Math.abs(info!.coord - 316164)).toBeLessThan(50)
    },
    { timeout: 10000 },
  )
}, 60000)

test('follow synteny works via horizontalScroll and across repeated scrolls', async () => {
  const view = await createFollowView()

  view.views[0]!.centerAt(28845300, 'Pp01')
  await waitFor(
    () => {
      expect(
        Math.abs(view.views[1]!.centerLineInfo!.coord - 316164),
      ).toBeLessThan(200)
    },
    { timeout: 10000 },
  )

  const before = view.views[1]!.centerLineInfo!.coord
  // horizontalScroll(-100) moves view0 toward lower peach coords; on the
  // minus strand the grape center moves toward higher coords
  view.views[0]!.horizontalScroll(-100)
  await waitFor(
    () => {
      const after = view.views[1]!.centerLineInfo!.coord
      expect(after).toBeGreaterThan(before)
    },
    { timeout: 10000 },
  )
}, 60000)

test('follow synteny follows navigation of the previously-followed view', async () => {
  const view = await createFollowView()

  view.views[0]!.centerAt(28845406, 'Pp01')
  await waitFor(
    () => {
      expect(
        Math.abs(view.views[1]!.centerLineInfo!.coord - 316164),
      ).toBeLessThan(50)
    },
    { timeout: 10000 },
  )

  // now navigate view1 (the one that was just auto-followed) — view0 should
  // follow back
  view.views[1]!.centerAt(316100, 'chr1')
  await waitFor(
    () => {
      const info = view.views[0]!.centerLineInfo
      expect(info?.refName).toBe('Pp01')
      expect(Math.abs(info!.coord - 28845406)).toBeLessThan(200)
    },
    { timeout: 10000 },
  )
}, 60000)

test('follow synteny catches up after a jump whose alignments render late', async () => {
  const { rootModel } = getPluginManager(configSnapshot)
  rootModel.setDefaultSession()
  const session = rootModel.session!

  // start both views far away from the alignment so the synteny display
  // initially renders with no features
  const view = session.addView('LinearSyntenyView', {
    init: {
      views: [
        { loc: 'Pp01:1..10,000', assembly: 'peach' },
        { loc: 'chr1:1..10,000', assembly: 'grape' },
      ],
      tracks: [['subset']],
    },
  }) as LinearSyntenyViewModel

  view.setWidth(800)

  await waitFor(() => expect(view.initialized).toBe(true), { timeout: 30000 })
  // wait for the synteny display to render the (empty) region
  await waitFor(
    () => {
      const d = view.levels[0]!.tracks[0]!.displays[0] as
        | { features?: Feature[] }
        | undefined
      expect(d?.features).toBeDefined()
    },
    { timeout: 30000 },
  )

  view.setFollowSynteny(true)

  // jump view0 into the aligned block; at navigation time the display's
  // loaded features still cover the old region, so the direct follow finds
  // no coverage — the resync autorun must apply the follow once the new
  // render arrives
  await view.views[0]!.navToLocString('Pp01:28,845,209..28,845,603')

  await waitFor(
    () => {
      const info = view.views[1]!.centerLineInfo
      expect(info?.refName).toBe('chr1')
      expect(Math.abs(info!.coord - 316164)).toBeLessThan(50)
    },
    { timeout: 30000 },
  )
}, 90000)

test('follow synteny works when the source shows a whole chromosome', async () => {
  const { rootModel } = getPluginManager(configSnapshot)
  rootModel.setDefaultSession()
  const session = rootModel.session!

  // view0 covers the aligned block (so its features load), view1 starts
  // somewhere unrelated
  const view = session.addView('LinearSyntenyView', {
    init: {
      views: [
        { loc: 'Pp01:28,845,209..28,845,603', assembly: 'peach' },
        { loc: 'chr1:1..10,000', assembly: 'grape' },
      ],
      tracks: [['subset']],
    },
  }) as LinearSyntenyViewModel

  view.setWidth(800)

  await waitFor(() => expect(view.initialized).toBe(true), { timeout: 30000 })
  await waitFor(() => expect(levelFeatures(view, 0).length).toBe(1), {
    timeout: 30000,
  })
  view.setFollowSynteny(true)

  // zoom view0 out to the whole Pp01 chromosome: its center is far from the
  // single alignment block, but the window overlaps it, so view1 should jump
  // to exactly the mapped segment chr1:315,959..316,369
  await view.views[0]!.navToLocString('Pp01')

  await waitFor(
    () => {
      const info = view.views[1]!.centerLineInfo
      expect(info?.refName).toBe('chr1')
      expect(Math.abs(info!.coord - 316164)).toBeLessThan(50)
      // the visible span should be exactly the mapped block, not the whole
      // chr1 chromosome
      const spanBp = view.views[1]!.bpPerPx * view.views[1]!.width
      expect(spanBp).toBeLessThan(1000)
    },
    { timeout: 30000 },
  )
}, 90000)

test('follow synteny catches up when the bottom view jumps', async () => {
  const { rootModel } = getPluginManager(configSnapshot)
  rootModel.setDefaultSession()
  const session = rootModel.session!

  // both views start far away from the alignment
  const view = session.addView('LinearSyntenyView', {
    init: {
      views: [
        { loc: 'Pp01:1..10,000', assembly: 'peach' },
        { loc: 'chr1:1..10,000', assembly: 'grape' },
      ],
      tracks: [['subset']],
    },
  }) as LinearSyntenyViewModel

  view.setWidth(800)

  await waitFor(() => expect(view.initialized).toBe(true), { timeout: 30000 })
  await waitFor(
    () => {
      const d = view.levels[0]!.tracks[0]!.displays[0] as
        | { features?: Feature[] }
        | undefined
      expect(d?.features).toBeDefined()
    },
    { timeout: 30000 },
  )

  view.setFollowSynteny(true)

  // jump the BOTTOM view into the aligned block. level 0's forward features
  // are fetched over the top view's blocks (Pp01:1..10,000) and have no
  // coverage of the new grape position, so only the reverse-coverage fetch
  // (triggered by the bottom view's own navigation) can satisfy the follow
  await view.views[1]!.navToLocString('chr1:315,959..316,369')

  await waitFor(
    () => {
      const info = view.views[0]!.centerLineInfo
      expect(info?.refName).toBe('Pp01')
      expect(Math.abs(info!.coord - 28845406)).toBeLessThan(50)
    },
    { timeout: 30000 },
  )
}, 90000)
