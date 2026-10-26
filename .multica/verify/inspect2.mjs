// Second exploration pass: get into the workspace view and dump the structure.
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
  page.on('console', msg => {
    const text = msg.text()
    if (
      msg.type() === 'error' ||
      text.includes('feature-chart') ||
      text.includes('sampleChart')
    ) {
      console.log(`[page ${msg.type()}] ${text.slice(0, 300)}`)
    }
  })
  page.on('pageerror', err => console.log(`[pageerror] ${err.message}`))

  await page.goto(
    `http://localhost:${PORT}/?config=test_data/feature-chart/config.json`,
    { waitUntil: 'domcontentloaded', timeout: 120_000 },
  )
  await new Promise(r => setTimeout(r, 6000))

  // close the "Available tracks" modal with Escape
  await page.keyboard.press('Escape')
  await new Promise(r => setTimeout(r, 500))

  const workspace = await page.$$('button')
  for (const button of workspace) {
    const text = await page.evaluate(el => el.textContent?.trim(), button)
    if (text === 'Workspace') {
      await button.click()
      break
    }
  }
  await new Promise(r => setTimeout(r, 6000))
  await page.keyboard.press('Escape')
  await new Promise(r => setTimeout(r, 1000))

  const dump = await page.evaluate(() => {
    const summarize = el => ({
      cls: el.className?.toString().slice(0, 80),
      testid: el.getAttribute('data-testid'),
      text: (el.textContent ?? '').trim().slice(0, 60),
    })
    return {
      probe: globalThis.__sampleChartDrawers,
      rpcDriver: (() => {
        try {
          return globalThis.__jbrowseRpcDriver ?? 'no global'
        } catch {
          return 'error'
        }
      })(),
      canvases: [...document.querySelectorAll('canvas')].map(c => ({
        width: c.width,
        height: c.height,
        cls: c.className?.toString().slice(0, 60),
        parentTestId: c.parentElement?.getAttribute('data-testid'),
      })),
      trackLabels: [...document.querySelectorAll('.track-label')].map(
        summarize,
      ),
      testIds: [
        ...new Set(
          [...document.querySelectorAll('[data-testid]')].map(el =>
            el.getAttribute('data-testid'),
          ),
        ),
      ].slice(0, 60),
      bodyText: document.body.innerText.slice(0, 1200),
    }
  })
  console.log(JSON.stringify(dump, null, 2))

  await page.screenshot({
    path: path.join(outDir, '02-workspace.png'),
    fullPage: false,
  })
} finally {
  await browser.close()
}
