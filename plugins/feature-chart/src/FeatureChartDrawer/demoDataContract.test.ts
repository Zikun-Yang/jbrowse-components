import fs from 'node:fs'
import path from 'node:path'

import PluginManager from '@jbrowse/core/PluginManager'
import LinearGenomeViewPlugin from '@jbrowse/plugin-linear-genome-view'

// @ts-expect-error - plain JS example without types, on purpose
import SampleChartDrawersModule from '../../../../test_data/feature-chart/plugins/sampleChartDrawers.js'
import FeatureChartPlugin from '../index.ts'
import { normalizeFromSpec, validateChartSpec } from './chartSpec.ts'
import { findUnknownDrawerOptions } from './drawerOptions.ts'
import {
  clearFeatureChartDrawerCache,
  initBuiltInDrawers,
  isFeatureChartDrawerResolutionError,
  listFeatureChartDrawers,
  resolveFeatureChartDrawer,
} from './drawerRegistry.ts'
import { paintCountFor } from './drawerTestHelpers.ts'

const SampleChartDrawers = SampleChartDrawersModule as unknown as new () => {
  name: string
  install(pluginManager: PluginManager): void
  configure(): void
}

const REPO_ROOT = path.resolve(__dirname, '../../../..')
const DEMO_DIR = path.join(REPO_ROOT, 'test_data', 'feature-chart')
const CONFIG_PATH = path.join(DEMO_DIR, 'config.json')

/**
 * The payload key each drawer reads. This is the contract between the TSV
 * files in `test_data/feature-chart` and the drawers the demo config selects:
 * if a drawer starts reading a different key, this map and the fixtures have to
 * change together, instead of the demo silently rendering blank charts.
 */
const REQUIRED_DATA_KEY: Record<string, string> = {
  precomputedBoxPlot: 'boxes',
  rawBoxPlot: 'tissues',
  rawViolinPlot: 'tissues',
  barPlot: 'bars',
  histogram: 'values',
  'samplePlugin/heatmap': 'tissues',
  'samplePlugin/dotPlot': 'tissues',
}

/**
 * Spec-driven demo tracks are validated through `normalizeFromSpec` instead of a
 * single payload key: a spec says where its data lives (`data.path`), and the
 * point of the demo is that this path really resolves in the shipped TSVs.
 */
const SPEC_DRIVEN = 'spec'

/** Tracks that exist to prove failure semantics; they must not resolve. */
const EXPECTED_ERRORS: Record<string, { missingPlugin?: string }> = {
  fc_broken: {},
  fc_missing_plugin: { missingPlugin: 'notLoadedPlugin' },
}

/** Tracks whose spec is deliberately invalid: they must report, not render. */
const EXPECTED_SPEC_ERRORS: Record<string, string> = {
  fc_spec_broken: 'does not accept data.form',
}

interface DemoTrack {
  trackId: string
  drawerName: string
  drawerOptions?: unknown
  spec?: unknown
  dataUri: string
}

interface DemoConfig {
  plugins?: unknown[]
  tracks: {
    trackId: string
    adapter: { uri?: string; dataLocation?: { uri?: string } }
    displays: {
      renderer: { drawer?: string; drawerOptions?: unknown; spec?: unknown }
    }[]
  }[]
}

interface DemoRow {
  data: unknown
  description?: string
  name: string
}

function readDemoConfig(): DemoConfig {
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) as DemoConfig
}

function demoTracks(): DemoTrack[] {
  return readDemoConfig().tracks.map(track => {
    const renderer = track.displays[0]!.renderer
    return {
      trackId: track.trackId,
      // `precomputedBoxPlot` is the renderer schema default, mirrored here on
      // purpose: the demo's first track omits `drawer` to prove the default.
      drawerName: renderer.drawer ?? 'precomputedBoxPlot',
      drawerOptions: renderer.drawerOptions,
      spec: renderer.spec,
      dataUri: (track.adapter.uri ?? track.adapter.dataLocation?.uri)!,
    }
  })
}

/** `/test_data/feature-chart/bars.tsv.gz` -> the three files the track uses. */
function dataFiles(uri: string) {
  const plain = path.join(
    REPO_ROOT,
    uri.replace(/^\//, '').replace(/\.gz$/, ''),
  )
  return {
    plain,
    bgzipped: `${plain}.gz`,
    index: `${plain}.gz.tbi`,
  }
}

/** Parse a demo TSV exactly the way `FeatureChartTabixAdapter` does. */
function readRows(plainPath: string): DemoRow[] {
  return fs
    .readFileSync(plainPath, 'utf8')
    .split('\n')
    .filter(line => line.length > 0)
    .map(line => {
      const cols = line.split('\t')
      return {
        name: cols[3] ?? '',
        description: cols[5],
        data: JSON.parse(cols[4]!),
      }
    })
}

function createPluginManager() {
  return new PluginManager([
    new LinearGenomeViewPlugin(),
    new FeatureChartPlugin(),
    new SampleChartDrawers(),
  ])
    .createPluggableElements()
    .configure()
}

beforeEach(() => {
  initBuiltInDrawers()
  clearFeatureChartDrawerCache()
})

describe('test_data/feature-chart: the data each configured drawer needs', () => {
  test('the demo config loads the example plugin and ships its source', () => {
    expect(readDemoConfig().plugins).toEqual([
      { esmLoc: { uri: 'plugins/sampleChartDrawers.js' } },
    ])
    expect(demoTracks().length).toBeGreaterThanOrEqual(9)
    expect(
      fs.existsSync(path.join(DEMO_DIR, 'plugins', 'sampleChartDrawers.js')),
    ).toBe(true)
  })

  test('the data-contract map covers exactly the reachable drawer catalog', () => {
    const catalog = listFeatureChartDrawers(createPluginManager())
      .map(meta => meta.name)
      .sort()
    expect(catalog).toEqual(
      [...Object.keys(REQUIRED_DATA_KEY), SPEC_DRIVEN].sort(),
    )
  })

  test.each(demoTracks().map(track => [track.trackId, track] as const))(
    '%s: files exist and every row carries what the drawer reads',
    (_trackId, track) => {
      const files = dataFiles(track.dataUri)

      // 1. the track's data actually ships: plain TSV, bgzip and tabix index
      for (const file of [files.plain, files.bgzipped, files.index]) {
        expect([file, fs.existsSync(file)]).toEqual([file, true])
      }
      // … and is really bgzip (the `.tbi` is BGZF-wrapped too), not a
      // plain-text file with a misleading extension
      expect(
        fs.readFileSync(files.bgzipped).subarray(0, 2).toString('hex'),
      ).toBe('1f8b')
      expect(fs.readFileSync(files.index).subarray(0, 2).toString('hex')).toBe(
        '1f8b',
      )

      const resolution = resolveFeatureChartDrawer(
        track.drawerName,
        createPluginManager(),
      )
      const expectedError = EXPECTED_ERRORS[track.trackId]

      if (expectedError) {
        // failure-semantics tracks: they must not resolve, and must still be
        // diagnosed as a drawer problem rather than a data problem
        if (!isFeatureChartDrawerResolutionError(resolution)) {
          throw new Error(
            `${track.trackId} was expected to be an unknown drawer, but "${track.drawerName}" resolved`,
          )
        }
        expect(resolution.missingPlugin).toBe(expectedError.missingPlugin)
        return
      }

      if (isFeatureChartDrawerResolutionError(resolution)) {
        throw new Error(
          `${track.trackId}: drawer "${track.drawerName}" did not resolve: ${resolution.error}`,
        )
      }

      const rows = readRows(files.plain)
      expect(rows.length).toBeGreaterThan(0)

      // Spec-driven tracks: every row must normalize cleanly and paint.
      if (track.drawerName === SPEC_DRIVEN) {
        const expectedSpecError = EXPECTED_SPEC_ERRORS[track.trackId]
        if (expectedSpecError) {
          const messages = validateChartSpec(track.spec)
            .map(error => error.message)
            .join('; ')
          expect([track.trackId, messages.includes(expectedSpecError)]).toEqual(
            [track.trackId, true],
          )
          return
        }
        for (const row of rows) {
          const normalization = normalizeFromSpec(track.spec, row.data)
          expect([track.trackId, normalization.errors]).toEqual([
            track.trackId,
            [],
          ])
          expect([
            track.trackId,
            paintCountFor(resolution.drawer, row.data, {
               
              model: (normalization as any).model,
            }) > 0,
          ]).toEqual([track.trackId, true])
        }
        expect(
          findUnknownDrawerOptions(resolution.meta, track.drawerOptions),
        ).toEqual([])
        return
      }

      const requiredKey = REQUIRED_DATA_KEY[track.drawerName]!

      for (const row of rows) {
        // 2. every row carries the payload key this drawer reads
        expect(row.data).not.toBeNull()
        const payload = row.data as Record<string, unknown>
        expect(Object.keys(payload)).toContain(requiredKey)

        const value = payload[requiredKey]
        if (Array.isArray(value)) {
          expect([track.trackId, value.length > 0]).toEqual([
            track.trackId,
            true,
          ])
        } else if (value && typeof value === 'object') {
          expect(Object.keys(value).length).toBeGreaterThan(0)
        } else {
          throw new Error(
            `${track.trackId}: data.${requiredKey} of ${row.name} is ${typeof value}`,
          )
        }

        // 3. the drawer turns that payload into pixels
        expect([
          track.trackId,
          paintCountFor(resolution.drawer, row.data) > 0,
        ]).toEqual([track.trackId, true])
      }

      // 4. the demo config must not trip the unknown-`drawerOptions` warning
      expect(
        findUnknownDrawerOptions(resolution.meta, track.drawerOptions),
      ).toEqual([])
    },
  )

  test('the deliberate failure tracks are the only unresolvable ones', () => {
    const pluginManager = createPluginManager()
    const broken = demoTracks()
      .filter(track => {
        const resolution = resolveFeatureChartDrawer(
          track.drawerName,
          pluginManager,
        )
        return isFeatureChartDrawerResolutionError(resolution)
      })
      .map(track => track.trackId)

    expect(broken.sort()).toEqual(Object.keys(EXPECTED_ERRORS).sort())
  })
})
