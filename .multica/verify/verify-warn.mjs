/**
 * Verification for the two follow-ups on WP2:
 *
 *   A. `drawerOptions` unknown-key warning (dev build only) — a config with a
 *      typo'd key must log exactly one `[feature-chart]` warning naming the
 *      drawer, the ignored key and the keys the drawer does read.
 *   B. drawer data payload is user data — a track whose TSV `data` column is
 *      literally `null` must paint nothing instead of failing the track.
 *
 * Plus the regression that matters for both: the plugin drawers still paint in
 * the RPC worker after the payload guard was added.
 *
 * Fixtures are written under `test_data/feature-chart/` (the dev server serves
 * the repo root) and removed again in the `finally` block.
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import puppeteer from 'puppeteer'

const PORT = Number(process.env.VERIFY_PORT ?? 3457)
const VIEW_ID = 'feature_chart_demo_view'
const demoDir = path.join(process.cwd(), 'test_data', 'feature-chart')
const outDir = path.join(process.cwd(), '.multica', 'artifacts')
fs.mkdirSync(outDir, { recursive: true })
const libs = path.join(process.env.HOME, '.pixi', 'envs', 'chrome-deps', 'lib')

const nullTsv = path.join(demoDir, 'null-values.tsv')
const warnConfig = path.join(demoDir, 'config.drawer-options-warn.json')

const results = []
function check(name, ok, detail) {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))

// --- fixtures ---------------------------------------------------------------
// Two rows whose `data` column parses to `null`: the payload a drawer used to
// dereference directly.
fs.writeFileSync(
  nullTsv,
  [
    'ctgA\t1000\t1100\tGENE_A\tnull\t**{{name}}** — data column is null',
    'ctgA\t6000\t6100\tGENE_B\tnull\t**{{name}}** — data column is null',
    '',
  ].join('\n'),
)
execFileSync('bgzip', ['-f', nullTsv])
execFileSync('tabix', ['-f', '-p', 'bed', `${nullTsv}.gz`])

const config = JSON.parse(
  fs.readFileSync(path.join(demoDir, 'config.json'), 'utf8'),
)
// A. one typo'd key on the plugin drawer (its optionsSchema reads colorRamp)
const heatmapTrack = config.tracks.find(t => t.trackId === 'fc_plugin_heatmap')
heatmapTrack.displays[0].renderer.drawerOptions.colourRamp = 'warm'
// B. a track whose payload is null
config.tracks.push({
  type: 'FeatureChartTrack',
  trackId: 'fc_null_payload',
  name: 'FC · null data payload',
  category: ['Feature chart demo'],
  assemblyNames: ['volvox'],
  adapter: {
    type: 'FeatureChartTabixAdapter',
    uri: '/test_data/feature-chart/null-values.tsv.gz',
  },
  displays: [
    {
      type: 'LinearFeatureChartDisplay',
      displayId: 'fc_null_payload-LinearFeatureChartDisplay',
      renderer: { type: 'FeatureChartRenderer', drawer: 'rawBoxPlot' },
    },
  ],
})
config.defaultSession.views[0].init.tracks.push('fc_null_payload')
fs.writeFileSync(warnConfig, JSON.stringify(config, null, 2))

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  env: {
    ...process.env,
    LD_LIBRARY_PATH: `${libs}:${process.env.LD_LIBRARY_PATH ?? ''}`,
  },
})

const consoleErrors = []
const consoleWarns = []

try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1600, height: 2200 })
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text())
    }
    if (msg.type() === 'warn' || msg.type() === 'warning') {
      consoleWarns.push(msg.text())
    }
  })
  page.on('pageerror', err => consoleErrors.push(`pageerror: ${err.message}`))

  await page.goto(
    `http://localhost:${PORT}/?config=test_data/feature-chart/config.drawer-options-warn.json`,
    { waitUntil: 'domcontentloaded', timeout: 120_000 },
  )
  await wait(8_000)
  await page.keyboard.press('Escape')
  await wait(500)
  for (const button of await page.$$('button')) {
    const text = await page.evaluate(el => el.textContent?.trim(), button)
    if (text === 'Workspace') {
      await button.click()
      break
    }
  }
  await wait(8_000)
  await page.keyboard.press('Escape')
  await wait(1_000)

  const scrollToTrack = async trackId => {
    await page.evaluate(
      ({ viewId, trackId: id }) => {
        const container = document.querySelector(
          '[data-testid="tracksContainer"]',
        )
        const track = document.querySelector(
          `[data-testid="trackRenderingContainer-${viewId}-${id}"]`,
        )
        if (!container || !track) {
          return
        }
        const delta =
          track.getBoundingClientRect().top -
          container.getBoundingClientRect().top
        container.scrollTop = container.scrollTop + delta - 60
      },
      { viewId: VIEW_ID, trackId },
    )
    await wait(2_500)
  }

  const trackRect = trackId =>
    page.evaluate(
      ({ viewId, trackId: id }) => {
        const track = document.querySelector(
          `[data-testid="trackRenderingContainer-${viewId}-${id}"]`,
        )
        if (!track) {
          return undefined
        }
        const rect = track.getBoundingClientRect()
        return { top: rect.top, left: rect.left, width: rect.width }
      },
      { viewId: VIEW_ID, trackId },
    )

  /** Hover along the display row until the maximize affordance shows up. */
  const hoverChart = async trackId => {
    await scrollToTrack(trackId)
    const rect = await trackRect(trackId)
    if (!rect) {
      return undefined
    }
    const y = rect.top + 40
    for (const offset of [
      60, 120, 200, 300, 420, 560, 700, 900, 1100, 1300, 1500,
    ]) {
      if (offset > rect.width - 10) {
        break
      }
      await page.mouse.move(rect.left + offset, y)
      await page.mouse.move(rect.left + offset + 4, y)
      await wait(250)
      if (await page.$('[data-testid="feature-chart-maximize"]')) {
        return offset
      }
    }
    return undefined
  }

  const scanCanvas = selector =>
    page.evaluate(sel => {
      const canvas = document.querySelector(sel)
      if (!canvas) {
        return { error: `no canvas for ${sel}` }
      }
      const { data } = canvas
        .getContext('2d')
        .getImageData(0, 0, canvas.width, canvas.height)
      let painted = 0
      let warm = 0
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i]
        const g = data[i + 1]
        const b = data[i + 2]
        const a = data[i + 3]
        if (a === 0 || (r > 250 && g > 250 && b > 250)) {
          continue
        }
        painted++
        if (r > 150 && r - b > 60 && g < 170) {
          warm++
        }
      }
      return { width: canvas.width, height: canvas.height, painted, warm }
    }, selector)

  // --- regression: plugin drawer still paints in the worker --------------
  await scrollToTrack('fc_plugin_heatmap')
  const heatmap = await scanCanvas(
    `[data-testid="trackRenderingContainer-${VIEW_ID}-fc_plugin_heatmap"] canvas`,
  )
  check(
    'the plugin heatmap still paints in the worker after the payload guard',
    (heatmap.warm ?? 0) > 500,
    JSON.stringify(heatmap),
  )

  const workerProbes = []
  for (const worker of page.workers()) {
    try {
      workerProbes.push(
        await worker.evaluate(() => globalThis.__sampleChartDrawers),
      )
    } catch (error) {
      workerProbes.push({ error: String(error) })
    }
  }
  check(
    'the worker still installs the drawer plugin',
    workerProbes.some(probe => probe?.context === 'worker'),
    `${page.workers().length} worker(s)`,
  )

  // --- A. unknown-key warning, observed from the main-thread path --------
  // The in-track canvas warns inside the RPC worker, whose console Puppeteer
  // does not forward to `page.on('console')`. The maximize dialog runs the same
  // `warnUnknownDrawerOptions()` on the main thread, which is exactly why it is
  // wired into both call sites.
  const dialogOffset = await hoverChart('fc_plugin_heatmap')
  if (dialogOffset !== undefined) {
    await page.click('[data-testid="feature-chart-maximize"]')
    await wait(2_500)
    await page.keyboard.press('Escape')
    await wait(1_500)
  }
  const optionWarnings = consoleWarns.filter(
    w => w.includes('[feature-chart]') && w.includes('drawerOptions'),
  )
  check(
    'a typo in drawerOptions warns in the dev build',
    optionWarnings.some(
      w =>
        w.includes('ignores unknown drawerOptions "colourRamp"') &&
        w.includes('samplePlugin/heatmap'),
    ),
    optionWarnings.slice(0, 2).join(' | ') || `dialog=${String(dialogOffset)}`,
  )
  check(
    'the warning says which keys the drawer does read',
    optionWarnings.some(w =>
      w.includes('it reads: colorRamp, cellGap, maxValue'),
    ),
    optionWarnings[0]?.slice(0, 200),
  )
  // One line per *rendering context* (the RPC worker that paints the track and
  // the main thread that paints the dialog). Each context renders the track's
  // two charts plus a dialog repaint, so anything above two means the dedupe is
  // not working.
  const rampWarnings = optionWarnings.filter(w => w.includes('"colourRamp"'))
  check(
    'the warning is deduped per context (one line each, not per chart)',
    rampWarnings.length >= 1 && rampWarnings.length <= 2,
    `${rampWarnings.length} line(s)`,
  )

  // --- B. null data payload ---------------------------------------------
  await scrollToTrack('fc_null_payload')
  const nullTrack = await scanCanvas(
    `[data-testid="trackRenderingContainer-${VIEW_ID}-fc_null_payload"] canvas`,
  )
  check(
    'a null data payload paints an empty chart instead of throwing',
    !nullTrack.error && nullTrack.painted === 0,
    JSON.stringify(nullTrack),
  )
  check(
    'the drawer options warning for the null track is not a data error',
    !consoleErrors.some(e => e.includes('null-values')),
    consoleErrors.filter(e => e.includes('null-values')).join(' | '),
  )

  await page.screenshot({
    path: path.join(outDir, '08-drawer-options-warn.png'),
    fullPage: false,
  })

  check(
    'no unexpected console errors',
    consoleErrors.filter(
      error =>
        !error.includes('Failed to load resource') &&
        !error.includes('favicon'),
    ).length === 0,
    consoleErrors.slice(0, 5).join(' | '),
  )
} finally {
  await browser.close()
  fs.rmSync(nullTsv, { force: true })
  fs.rmSync(`${nullTsv}.gz`, { force: true })
  fs.rmSync(`${nullTsv}.gz.tbi`, { force: true })
  fs.rmSync(warnConfig, { force: true })
  fs.writeFileSync(
    path.join(process.cwd(), '.multica', 'verify', 'warn-report.json'),
    JSON.stringify({ results, consoleErrors, consoleWarns }, null, 2),
  )
  const failed = results.filter(result => !result.ok)
  console.log(
    `\n${results.length - failed.length}/${results.length} checks passed`,
  )
  process.exitCode = failed.length === 0 ? 0 : 1
}
