const puppeteer = require('puppeteer')

async function main() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  })
  const page = await browser.newPage()
  await page.setViewport({ width: 1600, height: 900 })
  page.on('pageerror', e => console.error('PAGEERROR:', e.message))
  page.on('console', m => {
    if (m.type() === 'error') {
      console.error('CONSOLE:', m.text().slice(0, 300))
    }
  })

  await page.goto(
    'http://localhost:34219/?config=subconfig/tmp_cytoband_test.json',
    { waitUntil: 'domcontentloaded', timeout: 60000 },
  )

  // click Workspace sidebar button if present
  await new Promise(r => setTimeout(r, 3000))
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')]
    const b = btns.find(x => /workspace/i.test(x.textContent || ''))
    if (b) {
      b.click()
    }
  })

  // wait for the LGV overview to render
  await page
    .waitForSelector('[data-testid="tracksContainer"]', { timeout: 60000 })
    .catch(() => console.error('tracksContainer not found'))
  await new Promise(r => setTimeout(r, 5000))

  // measure geometry: find the overview scalebar area
  const info = await page.evaluate(() => {
    const contigs = [...document.querySelectorAll('div')].filter(
      d => d.querySelector(':scope > svg > g') && d.style.overflow === 'hidden',
    )
    const svgs = [...document.querySelectorAll('svg')].filter(s =>
      s.querySelector('polygon'),
    )
    const texts = [...document.querySelectorAll('svg text')].map(t => ({
      text: t.textContent,
      fill: t.getAttribute('fill'),
    }))
    const borderRects = [...document.querySelectorAll('svg rect[stroke]')].map(
      r => ({
        x: r.getAttribute('x'),
        w: r.getAttribute('width'),
        stroke: r.getAttribute('stroke'),
      }),
    )
    return {
      nContigSvgs: contigs.length,
      nPolygonSvgs: svgs.length,
      sampleLabels: texts.slice(0, 12),
      nLabels: texts.length,
      borderRects: borderRects.slice(0, 6),
    }
  })
  console.log(JSON.stringify(info, null, 2))

  await page.screenshot({ path: '/tmp/cytoband_full.png' })
  // crop to header area
  const el = await page.$('[data-testid="tracksContainer"]')
  if (el) {
    const box = await el.boundingBox()
    if (box) {
      await page.screenshot({
        path: '/tmp/cytoband_header.png',
        clip: {
          x: 0,
          y: Math.max(box.y - 130, 0),
          width: 1600,
          height: 170,
        },
      })
    }
  }
  await browser.close()
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
