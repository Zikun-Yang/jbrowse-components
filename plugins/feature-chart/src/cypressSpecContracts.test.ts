import fs from 'node:fs'
import path from 'node:path'

/**
 * The Cypress spec in `component_tests/app-vite/cypress/e2e/feature-chart.cy.ts`
 * runs in CI (the `component_tests` job, which is the only job with a browser),
 * so it cannot be executed as part of `pnpm test`. That makes it easy to break
 * without noticing: rename a `data-testid`, change the fixture URL parameter, and
 * the spec keeps sitting there green until a CI run that may not even reach it.
 *
 * This test is the cheap half of that safety net. It checks the spec against the
 * source it drives:
 *
 * - every `data-testid` the spec queries exists in the app source
 * - the `?e2e=` / `?about=` fixture switches the spec relies on still exist and
 *   still select the same tracks
 * - the fixture still renders through the real RPC worker (the point of the spec)
 *
 * It cannot prove the spec's assertions pass in a browser — that is what the CI
 * job does. It does make an unverified spec fail loudly instead of rottingly.
 */
const repoRoot = path.resolve(__dirname, '../../..')
const specPath = path.join(
  repoRoot,
  'component_tests/app-vite/cypress/e2e/feature-chart.cy.ts',
)
const spec = fs.readFileSync(specPath, 'utf8')

function read(file: string) {
  return fs.readFileSync(path.join(repoRoot, file), 'utf8')
}

/** all `data-testid=...` / `data-testid^=` / `data-testid$=` tokens in a file */
function testIdsOf(source: string): string[] {
  const ids = new Set<string>()
  const pattern = /data-testid\s*[\^*$]?=\s*"?'?([A-Za-z0-9_-]+)/g
  for (const match of source.matchAll(pattern)) {
    ids.add(match[1]!)
  }
  return [...ids].sort()
}

const SEARCH_DIRS = ['plugins', 'packages', 'products']

function findInSource(id: string, { excludeTests }: { excludeTests: boolean }) {
  const hits: string[] = []
  for (const dir of SEARCH_DIRS) {
    const stack = [path.join(repoRoot, dir)]
    while (stack.length > 0) {
      const current = stack.pop()!
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        if (entry.name === 'node_modules' || entry.name === 'esm') {
          continue
        }
        const full = path.join(current, entry.name)
        if (entry.isDirectory()) {
          stack.push(full)
        } else if (/\.(tsx|ts)$/.test(entry.name)) {
          if (excludeTests && /\.test\.(tsx|ts)$/.test(entry.name)) {
            continue
          }
          if (fs.readFileSync(full, 'utf8').includes(id)) {
            hits.push(path.relative(repoRoot, full))
          }
        }
      }
    }
  }
  return hits
}

describe('cypress feature-chart spec matches the source it drives', () => {
  test('every testid the spec queries exists in non-test source', () => {
    const ids = testIdsOf(spec)
    expect(ids.length).toBeGreaterThan(5)
    const missing = ids.filter(
      id => findInSource(id, { excludeTests: true }).length === 0,
    )
    // a rename on either side shows up here instead of only in CI
    expect(missing).toEqual([])
  })

  test('the fixture switches the spec relies on still exist', () => {
    const app = read('component_tests/app-vite/src/App.tsx')
    expect(app).toContain("params.get('e2e') === 'feature-chart'")
    expect(app).toContain("params.get('about') === '1'")
    // the worker driver is the point of this fixture: a main-thread fallback
    // would test the wrong code path
    expect(app).toContain("defaultDriver: 'WebWorkerRpcDriver'")
    expect(spec).toContain('WebWorkerRpcDriver')
  })

  test('the fixture still defines the four track slots the spec indexes', () => {
    const fixture = read('component_tests/app-vite/src/featureChartTracks.ts')
    for (const slot of ['drawer', 'spec', 'unknownDrawer', 'brokenSpec']) {
      expect(fixture).toMatch(new RegExp(`${slot}:`))
    }
    // and the spec still uses positional indexes for those four
    expect(spec).toMatch(/TRACK\s*=\s*\{[^}]*drawer:\s*0/)
    expect(spec).toMatch(/spec:\s*1/)
    expect(spec).toMatch(/unknownDrawer:\s*2/)
    expect(spec).toMatch(/brokenSpec:\s*3/)
  })

  test('the fixture data files the spec serves exist', () => {
    for (const file of [
      'component_tests/app-vite/public/feature-chart/precomputed-box.tsv.gz',
      'component_tests/app-vite/public/feature-chart/precomputed-box.tsv.gz.tbi',
      'component_tests/app-vite/public/feature-chart/raw-values.tsv.gz',
      'component_tests/app-vite/public/feature-chart/raw-values.tsv.gz.tbi',
    ]) {
      expect(fs.existsSync(path.join(repoRoot, file))).toBe(true)
    }
  })
})
