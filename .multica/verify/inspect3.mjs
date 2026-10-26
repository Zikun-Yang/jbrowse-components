// Inspect the workspace DOM: where are the track labels and display wrappers?
import fs from 'node:fs'
import path from 'node:path'
import puppeteer from 'puppeteer'

const PORT = Number(process.env.VERIFY_PORT ?? 3457)
const outDir = path.join(process.cwd(), '.multica', 'artifacts')
fs.mkdirSync(outDir, { recursive: true })
const libs = path.join(process.env.HOME, '.pixi', 'envs', 'chrome-deps', 'lib')

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  env: {
    ...process.env,
    LD_LIBRARY_PATH: `${libs}:${process.env.LD_LIBRARY_PATH ?? ''}`,
  },
})

try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1600, height: 1000 })
  await page.goto(
    `http://localhost:${PORT}/?config=test_data/feature-chart/config.json`,
    { waitUntil: 'domcontentloaded', timeout: 120_000 },
  )
  await new Promise(r => setTimeout(r, 8000))
  await page.keyboard.press('Escape')
  await new Promise(r => setTimeout(r, 500))
  for (const button of await page.$$('button')) {
    const text = await page.evaluate(el => el.textContent?.trim(), button)
    if (text === 'Workspace') {
      await button.click()
      break
    }
  }
  await new Promise(r => setTimeout(r, 8000))
  await page.keyboard.press('Escape')
  await new Promise(r => setTimeout(r, 1000))

  const dump = await page.evaluate(() => {
    const describe = el => {
      const rect = el.getBoundingClientRect()
      return {
        tag: el.tagName.toLowerCase(),
        testid: el.getAttribute('data-testid'),
        cls: (el.className ?? '').toString().slice(0, 70),
        text: (el.textContent ?? '').trim().slice(0, 50),
        top: Math.round(rect.top),
        left: Math.round(rect.left),
        w: Math.round(rect.width),
        h: Math.round(rect.height),
      }
    }
    const labels = [
      ...document.querySelectorAll(
        '[data-testid*="track"], [class*="track-label"], [class*="TrackLabel"]',
      ),
    ]
      .filter(el => (el.textContent ?? '').includes('FC ·'))
      .slice(0, 12)
      .map(describe)

    const displays = [
      ...document.querySelectorAll('[data-testid="feature-chart-display"]'),
    ]
      .slice(0, 12)
      .map(describe)

    const anyTestIds = [
      ...new Set(
        [...document.querySelectorAll('[data-testid]')].map(el =>
          el.getAttribute('data-testid'),
        ),
      ),
    ]
      .filter(id => /track|display|view/i.test(id))
      .slice(0, 40)

    // walk up from the first element containing "samplePlugin/heatmap"
    const anchor = [...document.querySelectorAll('*')].find(
      el =>
        el.children.length === 0 &&
        (el.textContent ?? '').includes('samplePlugin/heatmap'),
    )
    const chain = []
    let node = anchor
    for (let i = 0; i < 12 && node; i++) {
      chain.push(describe(node))
      node = node.parentElement
    }

    return {
      probe: globalThis.__sampleChartDrawers,
      isWorker: 'WorkerGlobalScope' in globalThis,
      labels,
      displays,
      anyTestIds,
      chain,
    }
  })
  console.log(JSON.stringify(dump, null, 1))
} finally {
  await browser.close()
}
