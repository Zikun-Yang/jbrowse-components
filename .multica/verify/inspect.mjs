// Exploratory dump: what does the app look like after loading the demo config?
import fs from 'node:fs'
import path from 'node:path'
import puppeteer from 'puppeteer'

const PORT = Number(process.env.VERIFY_PORT ?? 3457)
const outDir = path.join(process.cwd(), '.multica', 'artifacts')
fs.mkdirSync(outDir, { recursive: true })

function chromeLibPath() {
  const candidates = [
    path.join(process.env.HOME, '.pixi', 'envs', 'chrome-deps', 'lib'),
  ]
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate
    }
  }
  return undefined
}

const libs = chromeLibPath()
console.log('LD_LIBRARY_PATH extra:', libs ?? '(none)')

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  env: {
    ...process.env,
    ...(libs
      ? {
          LD_LIBRARY_PATH: `${libs}:${process.env.LD_LIBRARY_PATH ?? ''}`,
        }
      : {}),
  },
})

try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1600, height: 1000 })
  const logs = []
  page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`))
  page.on('pageerror', err => logs.push(`[pageerror] ${err.message}`))

  await page.goto(`http://localhost:${PORT}/?config=test_data/feature-chart/config.json`, {
    waitUntil: 'domcontentloaded',
    timeout: 120_000,
  })

  await new Promise(resolve => setTimeout(resolve, 8_000))

  const info = await page.evaluate(() => {
    const buttons = [...document.querySelectorAll('button,[role="button"],[role="tab"],a')]
      .map(el => ({
        tag: el.tagName,
        text: (el.textContent ?? '').trim().slice(0, 60),
        aria: el.getAttribute('aria-label'),
        title: el.getAttribute('title'),
        role: el.getAttribute('role'),
      }))
      .filter(b => b.text || b.aria || b.title)
      .slice(0, 80)
    return {
      title: document.title,
      url: location.href,
      bodyText: document.body.innerText.slice(0, 3000),
      buttons,
      probe: globalThis.__sampleChartDrawers,
    }
  })

  console.log(JSON.stringify(info, null, 2))
  console.log('--- console ---')
  console.log(logs.slice(-40).join('\n'))

  await page.screenshot({
    path: path.join(outDir, '01-landing.png'),
    fullPage: false,
  })
  console.log('screenshot written')
} finally {
  await browser.close()
}
