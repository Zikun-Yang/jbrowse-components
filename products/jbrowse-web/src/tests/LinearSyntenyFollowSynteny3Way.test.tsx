import { waitFor } from '@testing-library/react'
import { LocalFile } from 'generic-filehandle2'
import { configure } from 'mobx'

import { handleRequest } from './generateReadBuffer.ts'
import { getPluginManager, setup } from './util.tsx'
import configSnapshot from '../../test_data/volvox/config.json' with { type: 'json' }

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
    : `test_data/volvox/${cleanUrl}`
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

// 3-way: volvox_del <-> volvox (level 0, volvox_del.paf)
//        volvox <-> volvox_ins (level 1, volvox_ins.paf)
// all three alignments cover all of ctgA at similar coordinates
async function create3WayView() {
  const { rootModel } = getPluginManager(configSnapshot)
  rootModel.setDefaultSession()
  const session = rootModel.session!

  const view = session.addView('LinearSyntenyView', {
    init: {
      views: [
        { loc: 'ctgA:24,000..25,000', assembly: 'volvox_del' },
        { loc: 'ctgA:24,000..25,000', assembly: 'volvox' },
        { loc: 'ctgA:24,000..25,000', assembly: 'volvox_ins' },
      ],
      tracks: [['volvox_del.paf'], ['volvox_ins.paf']],
    },
  }) as LinearSyntenyViewModel

  view.setWidth(800)

  await waitFor(() => expect(view.initialized).toBe(true), { timeout: 30000 })
  await waitFor(() => expect(levelFeatures(view, 0).length).toBe(1), {
    timeout: 30000,
  })
  await waitFor(() => expect(levelFeatures(view, 1).length).toBe(1), {
    timeout: 30000,
  })
  view.setFollowSynteny(true)
  return view
}

test('navigating the middle view follows both directions', async () => {
  const view = await create3WayView()

  view.views[1]!.centerAt(24500, 'ctgA')

  await waitFor(
    () => {
      expect(view.views[2]!.centerLineInfo?.refName).toBe('ctgA')
      expect(
        Math.abs(view.views[2]!.centerLineInfo!.coord - 24500),
      ).toBeLessThan(200)
    },
    { timeout: 10000 },
  )
  await waitFor(
    () => {
      expect(view.views[0]!.centerLineInfo?.refName).toBe('ctgA')
      expect(
        Math.abs(view.views[0]!.centerLineInfo!.coord - 24500),
      ).toBeLessThan(200)
    },
    { timeout: 10000 },
  )
}, 90000)
