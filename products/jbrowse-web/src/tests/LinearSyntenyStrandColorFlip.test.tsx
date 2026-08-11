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

interface LevelDisplay {
  type: string
  features?: Feature[]
  featPositions?: { effStrand: number }[]
}

interface ColorDisplay {
  colorBy: string
  posColorWithAlpha: string
  negColorWithAlpha: string
}

test('strand colors default to gray forward and theme primary reverse', async () => {
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
    .displays[0] as unknown as ColorDisplay & LevelDisplay

  await waitFor(() => expect(display.featPositions?.length).toBe(1), {
    timeout: 30000,
  })

  expect(display.colorBy).toBe('strand')
  expect(display.posColorWithAlpha).toBe(colord('#757575').alpha(0.2).toHex())
  expect(display.negColorWithAlpha).toBe(
    colord((session as unknown as { theme: Theme }).theme.palette.primary.main)
      .alpha(0.2)
      .toHex(),
  )
}, 90000)

// subset.paf has a single minus-strand alignment:
// peach Pp01:28,845,209-28,845,603 <-> grape chr1:315,959-316,369
test('strand coloring follows horizontally flipped views', async () => {
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

  const display = view.levels[0]!.tracks[0]!.displays[0] as LevelDisplay
  await waitFor(() => expect(display.featPositions?.length).toBe(1), {
    timeout: 30000,
  })

  // minus-strand alignment: both views in normal orientation -> -1
  expect(display.featPositions![0]!.effStrand).toBe(-1)

  // flipping exactly one view flips the displayed slope
  view.views[0]!.horizontallyFlip()
  await waitFor(() => expect(display.featPositions![0]!.effStrand).toBe(1), {
    timeout: 10000,
  })

  // flipping the other view as well restores the original slope
  view.views[1]!.horizontallyFlip()
  await waitFor(() => expect(display.featPositions![0]!.effStrand).toBe(-1), {
    timeout: 10000,
  })
}, 90000)
