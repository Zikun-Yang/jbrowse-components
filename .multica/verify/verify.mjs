/**
 * End-to-end verification for WP2 (plugin drawers + drawerOptions).
 *
 * Runs against the real dev server. jbrowse-web defaults to
 * `WebWorkerRpcDriver` (products/jbrowse-web/src/createPluginManager.ts), so the
 * in-track canvas is painted by the RPC worker — exactly the path that used to
 * be broken for plugin-registered drawers.
 *
 * Checks:
 *   1. the example plugin installs on the main thread,
 *   2. it installs *inside the RPC worker* too (worker global probe),
 *   3. the worker-painted track canvas contains the plugin drawer's colours,
 *   4. the maximize dialog paints the plugin drawer (drawerOptions ramp),
 *   5. a drawer whose plugin is not loaded shows the "missing plugin" alert.
 */
import fs from 'node:fs'
import path from 'node:path'
import puppeteer from 'puppeteer'

const PORT = Number(process.env.VERIFY_PORT ?? 3457)
const VIEW_ID = 'feature_chart_demo_view'
const outDir = path.join(process.cwd(), '.multica', 'artifacts')
fs.mkdirSync(outDir, { recursive: true })
const libs = path.join(process.env.HOME, '.pixi', 'envs', 'chrome-deps', 'lib')

const results = []
function check(name, ok, detail) {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))

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
  // tall enough to fit all nine demo tracks: the in-track charts only render
  // once their row is actually visible
  await page.setViewport({ width: 1600, height: 2000 })
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
    `http://localhost:${PORT}/?config=test_data/feature-chart/config.json`,
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

  // 1. main-thread install
  const mainProbe = await page.evaluate(() => globalThis.__sampleChartDrawers)
  check(
    'plugin installs on the main thread',
    mainProbe?.context === 'main thread' &&
      mainProbe.drawers?.includes('samplePlugin/heatmap'),
    JSON.stringify(mainProbe),
  )

  // 2. worker install
  const workers = page.workers()
  const workerProbes = []
  for (const worker of workers) {
    try {
      workerProbes.push(
        await worker.evaluate(() => globalThis.__sampleChartDrawers),
      )
    } catch (error) {
      workerProbes.push({ error: String(error) })
    }
  }
  check(
    'plugin also installs inside the RPC worker',
    workerProbes.some(probe => probe?.context === 'worker'),
    `${workers.length} worker(s): ${JSON.stringify(workerProbes)}`,
  )

  const chartWarnings = consoleWarns.filter(w => w.includes('[feature-chart]'))
  // Match the warning *about* a plugin drawer, not any message that happens to
  // contain the name: the missing-plugin placeholder suggests
  // `samplePlugin/heatmap`, which used to make this check fail spuriously.
  check(
    'no "unknown drawer" warning for the plugin drawers',
    !chartWarnings.some(w =>
      w.includes('Unknown FeatureChart drawer "samplePlugin/'),
    ),
    chartWarnings.map(w => w.slice(0, 120)).join(' | '),
  )

  const scrollToTrack = async trackId => {
    const rect = await page.evaluate(
      ({ viewId, trackId: id }) => {
        const container = document.querySelector(
          '[data-testid="tracksContainer"]',
        )
        const track = document.querySelector(
          `[data-testid="trackRenderingContainer-${viewId}-${id}"]`,
        )
        if (!container || !track) {
          return undefined
        }
        const delta =
          track.getBoundingClientRect().top -
          container.getBoundingClientRect().top
        container.scrollTop = container.scrollTop + delta - 60
        return { scrolled: true }
      },
      { viewId: VIEW_ID, trackId },
    )
    await wait(2_500)
    return rect
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
        return {
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        }
      },
      { viewId: VIEW_ID, trackId },
    )

  /**
   * Scan a canvas for colour signatures. `kind` picks the predicate:
   *  - warm: the heatmap's `colorRamp: warm` (#fff6d9 → #b3300b)
   *  - blue: the dot plot's tableau10 #4e79a7 fill
   */
  const scanCanvas = (selector, kind) =>
    page.evaluate(
      ({ selector: sel, kind: colour }) => {
        const canvas = document.querySelector(sel)
        if (!canvas) {
          return { error: `no canvas for ${sel}` }
        }
        const ctx = canvas.getContext('2d')
        const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
        let warm = 0
        let blue = 0
        let painted = 0
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
          if (b > 110 && b - r > 25) {
            blue++
          }
        }
        return {
          width: canvas.width,
          height: canvas.height,
          painted,
          warm,
          blue,
        }
      },
      { selector, kind },
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
      60, 120, 200, 300, 420, 560, 700, 860, 1000, 1150, 1300, 1450,
    ]) {
      if (offset > rect.width - 10) {
        break
      }
      await page.mouse.move(rect.left + offset, y)
      await page.mouse.move(rect.left + offset + 4, y)
      await wait(250)
      const icon = await page.$('[data-testid="feature-chart-maximize"]')
      if (icon) {
        return { rect, offset }
      }
    }
    return { rect, offset: undefined }
  }

  /** Track canvas painted by the worker. */
  await scrollToTrack('fc_plugin_heatmap')
  await wait(2_500)
  const heatmapTrack = await scanCanvas(
    `[data-testid="trackRenderingContainer-${VIEW_ID}-fc_plugin_heatmap"] canvas`,
    'warm',
  )
  check(
    'worker-painted track canvas contains the plugin heatmap ramp',
    (heatmapTrack.warm ?? 0) > 500,
    JSON.stringify(heatmapTrack),
  )

  await scrollToTrack('fc_plugin_dots')
  await wait(2_500)
  const dotsTrack = await scanCanvas(
    `[data-testid="trackRenderingContainer-${VIEW_ID}-fc_plugin_dots"] canvas`,
    'blue',
  )
  check(
    'worker-painted track canvas contains the plugin dot plot',
    (dotsTrack.blue ?? 0) > 200,
    JSON.stringify(dotsTrack),
  )

  await page.screenshot({
    path: path.join(outDir, '06-workspace-plugin-tracks.png'),
    fullPage: false,
  })

  const openDialog = async trackId => {
    const hover = await hoverChart(trackId)
    if (!hover?.offset) {
      return { error: `no chart found in ${trackId}`, hover }
    }
    await page.click('[data-testid="feature-chart-maximize"]')
    await wait(2_500)
    const alert = await page.evaluate(
      () => document.querySelector('[role="alert"]')?.textContent ?? null,
    )
    const canvas = await scanCanvas(
      '[data-testid="feature-chart-maximize-canvas"]',
      'warm',
    )
    return { hover, alert, canvas }
  }

  const closeDialog = async () => {
    await page.keyboard.press('Escape')
    await wait(1_500)
  }

  const heatmapDialog = await openDialog('fc_plugin_heatmap')
  await page.screenshot({
    path: path.join(outDir, '03-plugin-heatmap-dialog.png'),
    fullPage: false,
  })
  check(
    'maximize dialog for a plugin drawer opens without an alert',
    heatmapDialog.alert === null,
    JSON.stringify({
      alert: heatmapDialog.alert,
      error: heatmapDialog.error,
      canvas: heatmapDialog.canvas,
    }),
  )
  check(
    'maximize dialog paints the plugin heatmap with its warm ramp',
    (heatmapDialog.canvas?.warm ?? 0) > 2_000,
    JSON.stringify(heatmapDialog.canvas),
  )
  await closeDialog()

  const dotsDialog = await openDialog('fc_plugin_dots')
  await page.screenshot({
    path: path.join(outDir, '04-plugin-dotplot-dialog.png'),
    fullPage: false,
  })
  check(
    'second drawer of the same plugin paints in the dialog too',
    dotsDialog.alert === null && (dotsDialog.canvas?.blue ?? 0) > 200,
    JSON.stringify({ alert: dotsDialog.alert, canvas: dotsDialog.canvas }),
  )
  await closeDialog()

  const missingDialog = await openDialog('fc_missing_plugin')
  await page.screenshot({
    path: path.join(outDir, '05-missing-plugin-dialog.png'),
    fullPage: false,
  })
  check(
    'a drawer whose plugin is not loaded explains the missing plugin',
    typeof missingDialog.alert === 'string' &&
      missingDialog.alert.includes('Missing plugin') &&
      missingDialog.alert.includes('notLoadedPlugin'),
    String(missingDialog.alert).slice(0, 300),
  )
  await closeDialog()

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
  fs.writeFileSync(
    path.join(outDir, 'verify-report.json'),
    JSON.stringify({ results, consoleErrors, consoleWarns }, null, 2),
  )
  const failed = results.filter(result => !result.ok)
  console.log(
    `\n${results.length - failed.length}/${results.length} checks passed`,
  )
  process.exitCode = failed.length === 0 ? 0 : 1
}
