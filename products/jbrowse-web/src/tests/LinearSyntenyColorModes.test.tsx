import { waitFor } from '@testing-library/react'
import { colord } from '@jbrowse/core/util/colord'
import { LocalFile } from 'generic-filehandle2'
import { configure } from 'mobx'

import { handleRequest } from './generateReadBuffer.ts'
import { getPluginManager, setup } from './util.tsx'
import configSnapshot from '../../test_data/grape_peach_synteny/config.json' with { type: 'json' }

import type { LinearSyntenyViewModel } from '@jbrowse/plugin-linear-comparative-view'
import type { Feature } from '@jbrowse/core/util'
import type { Theme } from '@mui/material'

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

interface ColorModeDisplay {
  colorBy: string
  featPositions?: { f: Feature; effStrand: number; fill?: string }[]
  setColorBy: (arg: string) => void
}

// subset.paf: peach Pp01:28,845,209-28,845,603 <-> grape chr1:315,959-316,369,
// numMatches=330 blockLen=413 -> identity ~0.799, below the 85% window floor
async function makeView() {
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

  const display = view.levels[0]!.tracks[0]!
    .displays[0] as unknown as ColorModeDisplay
  await waitFor(() => expect(display.featPositions?.length).toBe(1), {
    timeout: 30000,
  })
  return { session, view, display }
}

test('strand mode leaves fill unset', async () => {
  const { display } = await makeView()
  expect(display.colorBy).toBe('strand')
  expect(display.featPositions![0]!.fill).toBeUndefined()
}, 90000)

test('identity mode colors by alignment identity, clamped below 85%', async () => {
  const { session, display } = await makeView()
  display.setColorBy('identity')

  await waitFor(() => expect(display.featPositions![0]!.fill).toBeDefined(), {
    timeout: 10000,
  })

  const { theme } = session as unknown as { theme: Theme }
  const themeHue = colord(theme.palette.primary.main).toHsl().h
  const hsl = colord(display.featPositions![0]!.fill!).toHsl()
  // identity ~0.799 clamps to the low end of the scale: the theme hue
  expect(Math.abs(hsl.h - themeHue)).toBeLessThan(2)
  expect(hsl.a).toBeCloseTo(0.2, 2)
}, 90000)

test('rainbow mode colors by position along the displayed regions', async () => {
  const { view, display } = await makeView()
  display.setColorBy('rainbow')

  // anchor defaults to view 0 (peach): the view displays the whole Pp01
  // chromosome (47,851,208 bp), feature midpoint at 28,845,406
  await waitFor(() => expect(display.featPositions![0]!.fill).toBeDefined(), {
    timeout: 10000,
  })
  const peachFrac = 28845406 / 47851208
  const hsl0 = colord(display.featPositions![0]!.fill!).toHsl()
  expect(Math.abs(hsl0.h - 260 * (1 - peachFrac))).toBeLessThan(2)

  // switch anchor to view 1 (grape): whole chr1 (23,037,639 bp),
  // mate midpoint 316,164
  view.setRainbowAnchor(1)
  await waitFor(
    () =>
      expect(
        colord(display.featPositions![0]!.fill!).toHsl().h,
      ).toBeGreaterThan(200),
    { timeout: 10000 },
  )
  const grapeFrac = 316164 / 23037639
  const hsl1 = colord(display.featPositions![0]!.fill!).toHsl()
  expect(Math.abs(hsl1.h - 260 * (1 - grapeFrac))).toBeLessThan(2)
}, 90000)

test('rainbow concatenates multiple displayed regions in order', async () => {
  const { view, display } = await makeView()
  display.setColorBy('rainbow')
  await waitFor(() => expect(display.featPositions![0]!.fill).toBeDefined(), {
    timeout: 10000,
  })

  // add a second 100 kb region after the first: total displayed length
  // doubles, so the feature's fraction halves
  view.views[0]!.setDisplayedRegions([
    {
      assemblyName: 'peach',
      refName: 'Pp01',
      start: 28800000,
      end: 28900000,
    },
    { assemblyName: 'peach', refName: 'Pp02', start: 0, end: 100000 },
  ])
  await waitFor(
    () =>
      expect(
        colord(display.featPositions![0]!.fill!).toHsl().h,
      ).toBeGreaterThan(190),
    { timeout: 10000 },
  )
  const frac = (28845406 - 28800000) / 200000
  const hsl = colord(display.featPositions![0]!.fill!).toHsl()
  expect(Math.abs(hsl.h - 260 * (1 - frac))).toBeLessThan(2)
}, 90000)

test('rainbow mode mirrors coordinates when the anchor region is flipped', async () => {
  const { view, display } = await makeView()
  display.setColorBy('rainbow')
  await waitFor(() => expect(display.featPositions![0]!.fill).toBeDefined(), {
    timeout: 10000,
  })
  const forwardHue = colord(display.featPositions![0]!.fill!).toHsl().h

  // flipping the anchor view mirrors the within-region coordinate so the
  // on-screen gradient keeps its left-to-right direction
  view.views[0]!.horizontallyFlip()
  await waitFor(
    () =>
      expect(
        Math.abs(
          colord(display.featPositions![0]!.fill!).toHsl().h - forwardHue,
        ),
      ).toBeGreaterThan(2),
    { timeout: 10000 },
  )
  const flippedFrac = (47851208 - 28845406) / 47851208
  const hsl = colord(display.featPositions![0]!.fill!).toHsl()
  expect(Math.abs(hsl.h - 260 * (1 - flippedFrac))).toBeLessThan(2)
}, 90000)
