#!/usr/bin/env node
/**
 * jbrowse-agent runner.
 *
 * Launches a fresh browser (system Chrome by default), opens a JBrowse
 * instance, injects @jbrowse/agent-sdk, then executes a user script in the
 * page context with a `jbrowse` object in scope.
 *
 * Usage:
 *   node run.mjs <script.js> [--url URL] [--headed] [--chrome PATH]
 *                            [--timeout MS] [--keep-open]
 *
 * Output contract (stdout): a single JSON envelope —
 *   { "ok": true,  "result": <script return value>, "state": <StateDigest> }
 *   { "ok": false, "error": { "message", "code?", "candidates?" },
 *     "state": <StateDigest> }
 * Page console output goes to stderr, so stdout stays machine-readable.
 *
 * The script runs as an async function body: use top-level `await` and
 * `return` the value you want in `result`.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SDK_PATH = path.resolve(__dirname, '../../packages/agent-sdk/src/index.js')

const DEFAULT_URL = 'http://localhost:3000'
const DEFAULT_TIMEOUT = 120_000

/**
 * All file-writing bridges (screenshot/saveFile/download) are confined to
 * this directory. Absolute paths and `..` traversal that would land outside
 * are rejected — the bridges are callable by ANY script in the target page,
 * not just our SDK, so an untrusted remote site must not be able to write
 * outside it. Override with --out-dir.
 */
const DEFAULT_OUT_DIR = '/tmp/jbrowse-agent-out'

function resolveOutPath(outDir, userPath) {
  const target = path.resolve(outDir, String(userPath).replace(/^[/~]+/, ''))
  const rel = path.relative(outDir, target)
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(
      `PATH_OUTSIDE_OUT_DIR: "${userPath}" resolves outside ${outDir}`,
    )
  }
  return target
}

function sanitizeFilename(name) {
  return path.basename(String(name)).replace(/[^\w.()-]/g, '_') || 'download'
}

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean)

function parseArgs(argv) {
  const args = {
    url: DEFAULT_URL,
    headed: false,
    timeout: DEFAULT_TIMEOUT,
    keepOpen: false,
    scriptTimeout: 90_000,
    outDir: DEFAULT_OUT_DIR,
  }
  const positional = []
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--url':
        args.url = argv[++i]
        break
      case '--chrome':
        args.chrome = argv[++i]
        break
      case '--timeout':
        args.timeout = Number(argv[++i])
        break
      case '--script-timeout':
        args.scriptTimeout = Number(argv[++i])
        break
      case '--out-dir':
        args.outDir = argv[++i]
        break
      case '--headed':
        args.headed = true
        break
      case '--keep-open':
        args.keepOpen = true
        break
      default:
        positional.push(argv[i])
    }
  }
  args.script = positional[0]
  return args
}

function findChrome(override) {
  if (override) {
    return override
  }
  for (const candidate of CHROME_CANDIDATES) {
    if (existsSync(candidate)) {
      return candidate
    }
  }
  return undefined
}

function usage() {
  console.error(
    'usage: node run.mjs <script.js> [--url URL] [--headed] [--chrome PATH] [--timeout MS] [--script-timeout MS] [--out-dir DIR] [--keep-open]',
  )
  process.exit(2)
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (!args.script || !existsSync(args.script)) {
    usage()
  }
  const userCode = readFileSync(args.script, 'utf8')
  const sdkCode = readFileSync(SDK_PATH, 'utf8')
  mkdirSync(args.outDir, { recursive: true })

  const executablePath = findChrome(args.chrome)
  const browser = await chromium.launch({
    headless: !args.headed,
    executablePath,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  })

  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
      acceptDownloads: true,
    })
    page.on('console', msg => console.error('[page]', msg.text()))
    page.on('pageerror', err => console.error('[pageerror]', err.message))

    // downloads triggered by JBrowse's own export (exportSvg → FileSaver).
    // A script "arms" a target path via __jbrowseBridgeArmDownload; the next
    // download is saved there and the armed promise resolves.
    let armedDownload = null
    page.on('download', async dl => {
      try {
        if (armedDownload) {
          const target = resolveOutPath(args.outDir, armedDownload.path)
          await dl.saveAs(target)
          console.error('[agent] download saved:', target)
          clearTimeout(armedDownload.timer)
          armedDownload.resolve(target)
          armedDownload = null
        } else {
          const target = resolveOutPath(
            args.outDir,
            sanitizeFilename(dl.suggestedFilename()),
          )
          await dl.saveAs(target)
          console.error('[agent] unarmed download saved:', target)
        }
      } catch (err) {
        if (armedDownload) {
          clearTimeout(armedDownload.timer)
          armedDownload.reject(err)
          armedDownload = null
        } else {
          console.error('[agent] download rejected:', err.message)
        }
      }
    })

    console.error(`[agent] opening ${args.url} ...`)
    await page.goto(args.url, { timeout: args.timeout, waitUntil: 'domcontentloaded' })
    await page.waitForFunction(
      () =>
        window.JBrowseSession && window.JBrowseSession.assemblies?.length > 0,
      undefined,
      { timeout: args.timeout },
    )
    // let the default session materialize (views are added async)
    await page.waitForTimeout(2000)
    console.error('[agent] session ready, executing script')

    // screenshot bridge: SDK calls this, runner saves PNG from the Node side.
    // JBrowse clips overflowing content (tall tracks, stacked view rows)
    // inside NESTED auto/hidden-overflow containers — the top-level element's
    // scrollHeight often equals its clientHeight while descendants clip. An
    // element screenshot only captures the element's laid-out box, so before
    // shooting we pin every clipping descendant (walking up level by level,
    // then the target itself and its ancestors) to its full content size,
    // grow the viewport so the expanded box is on screen, wait for
    // re-rendering to settle, shoot, then restore everything.
    await page.exposeFunction('__jbrowseBridgeScreenshot', async payload => {
      const target = resolveOutPath(args.outDir, payload.path)
      const opts = { path: target }
      if (payload.selector) {
        const locator = page.locator(payload.selector).first()
        const handle = await locator.elementHandle()
        const vp = page.viewportSize() || { width: 1280, height: 720 }
        let resized = false
        const expandOverflowers = () =>
          handle.evaluate(el => {
            const touched = (window.__jbrowseShotTouched =
              window.__jbrowseShotTouched || [])
            const mark = node => {
              if (!('__jbrowseShotOrig' in node)) {
                node.__jbrowseShotOrig = node.getAttribute('style')
                touched.push(node)
              }
            }
            // ancestors must not clip the expanded target
            for (
              let a = el.parentElement;
              a && a !== document.body;
              a = a.parentElement
            ) {
              mark(a)
              a.style.overflow = 'visible'
              a.style.maxHeight = 'none'
            }
            mark(el)
            el.style.overflow = 'visible'
            el.style.maxHeight = 'none'
            // each pass grows one more ancestor level: children expand first,
            // then their parents (now overflowing) on the next pass
            for (let pass = 0; pass < 10; pass++) {
              let changed = false
              for (const node of el.querySelectorAll('*')) {
                const dh = node.scrollHeight - node.clientHeight
                const dw = node.scrollWidth - node.clientWidth
                if (dh <= 4 && dw <= 4) {
                  continue
                }
                const cs = getComputedStyle(node)
                const clipY = dh > 4 && cs.overflowY !== 'visible'
                const clipX = dw > 4 && cs.overflowX !== 'visible'
                if (!clipY && !clipX) {
                  continue
                }
                mark(node)
                if (clipY) {
                  node.style.height = node.scrollHeight + 'px'
                  node.style.overflowY = 'visible'
                }
                if (clipX) {
                  node.style.width = node.scrollWidth + 'px'
                  node.style.overflowX = 'visible'
                }
                node.style.maxHeight = 'none'
                changed = true
              }
              if (!changed) {
                break
              }
            }
            // measure BEFORE pinning the target's own height
            const dims = {
              clientW: el.clientWidth,
              clientH: el.clientHeight,
              scrollW: el.scrollWidth,
              scrollH: el.scrollHeight,
            }
            if (dims.scrollH - dims.clientH > 4) {
              el.style.height = dims.scrollH + 'px'
            }
            dims.expanded = touched.length
            return dims
          })
        const restoreStyles = () =>
          handle
            .evaluate(() => {
              for (const node of window.__jbrowseShotTouched || []) {
                const orig = node.__jbrowseShotOrig
                if (orig === null) {
                  node.removeAttribute('style')
                } else {
                  node.setAttribute('style', orig)
                }
                delete node.__jbrowseShotOrig
              }
              window.__jbrowseShotTouched = null
            })
            .catch(() => {})
        if (handle && !payload.noExpand) {
          await expandOverflowers()
          // The expanded element now towers over the viewport. Chrome
          // discards raster data for content outside the viewport (2D canvas
          // tiles come out blank in the capture), so growing the viewport is
          // NOT optional: the whole element must be genuinely on screen.
          // Measure its bounding box and grow to fit, then re-expand in case
          // the resize-triggered re-render re-clipped something.
          for (let round = 0; round < 2; round++) {
            const box = await handle.evaluate(el => {
              const r = el.getBoundingClientRect()
              return { w: r.width, h: r.height, top: r.top, left: r.left }
            })
            const wantW = Math.min(
              Math.max(vp.width, Math.ceil(box.left + box.w)),
              8000,
            )
            const wantH = Math.min(
              Math.max(vp.height, Math.ceil(box.top + box.h)),
              12000,
            )
            if (wantW <= vp.width && wantH <= vp.height) {
              break
            }
            const size = await page.viewportSize()
            if (size && wantW <= size.width && wantH <= size.height) {
              break
            }
            console.error(
              `[agent] growing viewport ${vp.width}x${vp.height} -> ${wantW}x${wantH} to fit overflowing content`,
            )
            await page.setViewportSize({ width: wantW, height: wantH })
            resized = true
            // newly revealed area triggers fresh renders — wait for idle
            try {
              await page.evaluate(() =>
                window.__jbrowseAgent?.waitForIdle({ timeoutMs: 30000 }),
              )
            } catch {
              await page.waitForTimeout(2000)
            }
            await expandOverflowers()
          }
        }
        try {
          await locator.screenshot(opts)
        } finally {
          if (handle) {
            await restoreStyles()
          }
          if (resized) {
            await page.setViewportSize(vp)
          }
        }
      } else {
        opts.fullPage = !!payload.fullPage
        await page.screenshot(opts)
      }
      console.error('[agent] screenshot saved:', target)
      return target
    })

    // save-file bridge: arbitrary text content (e.g. session JSON export)
    await page.exposeFunction('__jbrowseBridgeSaveFile', async payload => {
      const target = resolveOutPath(args.outDir, payload.path)
      mkdirSync(path.dirname(target), { recursive: true })
      writeFileSync(target, payload.content)
      console.error('[agent] file saved:', target)
      return target
    })

    // download-arming bridge: resolves when the next browser download lands
    await page.exposeFunction('__jbrowseBridgeArmDownload', payload => {
      return new Promise((resolve, reject) => {
        armedDownload = {
          path: typeof payload === 'string' ? payload : payload.path,
          resolve,
          reject,
          timer: setTimeout(() => {
            armedDownload = null
            reject(
              new Error(
                'DOWNLOAD_TIMEOUT: no download arrived within 60s of arming',
              ),
            )
          }, 60_000),
        }
      })
    })

    const envelope = await page.evaluate(
      async ({ sdkCode, userCode, scriptTimeout }) => {
        // inject SDK, then run the script with `jbrowse` in scope
        new Function(sdkCode)()
        const jbrowse = window.__createJBrowseAgent()
        // let Node-side bridges reach the agent (e.g. post-resize idle wait)
        window.__jbrowseAgent = jbrowse
        const run = new Function(
          'jbrowse',
          `return (async () => {\n${userCode}\n})()`,
        )
        const timeout = new Promise((_, reject) =>
          setTimeout(
            () =>
              reject(
                Object.assign(
                  new Error(
                    `SCRIPT_TIMEOUT: script did not finish within ${scriptTimeout}ms`,
                  ),
                  {
                    code: 'SCRIPT_TIMEOUT',
                    candidates: [
                      'increase --script-timeout',
                      'a goto() on a remote assembly may be blocked on slow network — try a local one',
                    ],
                  },
                ),
              ),
            scriptTimeout,
          ),
        )
        try {
          const result = await Promise.race([run(jbrowse), timeout])
          return {
            ok: true,
            result: jbrowse.__serialize(result),
            state: jbrowse.digest(),
          }
        } catch (err) {
          return {
            ok: false,
            error: {
              message: err && err.message ? String(err.message) : String(err),
              code: err && err.code,
              candidates: err && err.candidates,
            },
            state: jbrowse.digest(),
          }
        }
      },
      { sdkCode, userCode, scriptTimeout: args.scriptTimeout },
    )

    process.stdout.write(JSON.stringify(envelope, null, 2) + '\n')

    if (args.keepOpen) {
      console.error('[agent] --keep-open: browser stays up, Ctrl-C to exit')
      await new Promise(() => {})
    }
  } finally {
    if (!args.keepOpen) {
      await browser.close()
    }
  }
}

main().catch(err => {
  process.stdout.write(
    JSON.stringify(
      { ok: false, error: { message: String(err && err.message ? err.message : err) } },
      null,
      2,
    ) + '\n',
  )
  process.exit(1)
})
