// Debug: why doesn't hovering reveal the maximize affordance?
import fs from 'node:fs'
import path from 'node:path'
import puppeteer from 'puppeteer'

const PORT = Number(process.env.VERIFY_PORT ?? 3457)
const VIEW_ID = 'feature_chart_demo_view'
const outDir = path.join(process.cwd(), '.multica', 'artifacts')
fs.mkdirSync(outDir, { recursive: true })
const libs = path.join(process.env.HOME, '.pixi', 'envs', 'chrome-deps', 'lib')
const wait = ms => new Promise(r => setTimeout(r, ms))

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  env: { ...process.env, LD_LIBRARY_PATH: `${libs}:${process.env.LD_LIBRARY_PATH ?? ''}` },
})

try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1600, height: 2000 })
  await page.goto(`http://localhost:${PORT}/?config=test_data/feature-chart/config.json`, {
    waitUntil: 'domcontentloaded',
    timeout: 120_000,
  })
  await wait(8000)
  await page.keyboard.press('Escape')
  await wait(500)
  for (const button of await page.$$('button')) {
    const text = await page.evaluate(el => el.textContent?.trim(), button)
    if (text === 'Workspace') {
      await button.click()
      break
    }
  }
  await wait(8000)
  await page.keyboard.press('Escape')
  await wait(1000)

  const scrollDebug = await page.evaluate(() => {
    const container = document.querySelector('[data-testid="tracksContainer"]')
    const styles = []
    let node = container
    for (let i = 0; i < 5 && node; i++) {
      const cs = getComputedStyle(node)
      styles.push({
        testid: node.getAttribute('data-testid'),
        overflowY: cs.overflowY,
        scrollHeight: node.scrollHeight,
        clientHeight: node.clientHeight,
        scrollTop: node.scrollTop,
      })
      node = node.parentElement
    }
    return styles
  })
  console.log('scroll containers:', JSON.stringify(scrollDebug, null, 1))

  const scrolled = await page.evaluate(
    ({ viewId, id }) => {
      const container = document.querySelector('[data-testid="tracksContainer"]')
      const track = document.querySelector(
        `[data-testid="trackRenderingContainer-${viewId}-${id}"]`,
      )
      const delta =
        track.getBoundingClientRect().top - container.getBoundingClientRect().top
      container.scrollTop = container.scrollTop + delta - 60
      const containerRect = container.getBoundingClientRect()
      const trackRect = track.getBoundingClientRect()
      const display = track.querySelector('[data-testid="feature-chart-display"]')
      const displayRect = display?.getBoundingClientRect()
      return {
        containerRect: { top: containerRect.top, left: containerRect.left, h: containerRect.height },
        trackRect: { top: trackRect.top, left: trackRect.left, w: trackRect.width, h: trackRect.height },
        displayRect: displayRect && {
          top: displayRect.top,
          left: displayRect.left,
          w: displayRect.width,
          h: displayRect.height,
        },
        html: track.innerHTML.slice(0, 600),
      }
    },
    { viewId: VIEW_ID, id: 'fc_plugin_heatmap' },
  )
  console.log(JSON.stringify(scrolled, null, 1))
  await wait(3000)

  const rect = scrolled.displayRect
  for (const y of [rect.top + 40, rect.top + 90, rect.top + 150]) {
    for (const offset of [80, 200, 400, 700, 880, 940, 1000, 1200]) {
      await page.mouse.move(rect.left + offset, y)
      await wait(120)
      const state = await page.evaluate(
        ({ x, y: pointY }) => {
          const el = document.elementFromPoint(x, pointY)
          return {
            under: el
              ? `${el.tagName.toLowerCase()}[${el.getAttribute('data-testid') ?? ''}].${(el.className ?? '').toString().slice(0, 30)}`
              : 'none',
            icon: !!document.querySelector('[data-testid="feature-chart-maximize"]'),
            iconCount: document.querySelectorAll('[data-testid="feature-chart-maximize"]').length,
          }
        },
        { x: rect.left + offset, y },
      )
      if (state.icon) {
        console.log('ICON FOUND at', { offset, y: y - rect.top }, JSON.stringify(state))
        break
      }
      if (offset === 80) {
        console.log('sample element under cursor:', JSON.stringify(state))
      }
    }
    const found = await page.$('[data-testid="feature-chart-maximize"]')
    if (found) {
      break
    }
  }
  await page.screenshot({ path: path.join(outDir, '07-hover-debug.png') })
  console.log('screenshot 07-hover-debug.png')
} finally {
  await browser.close()
}
