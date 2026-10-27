/* eslint-disable no-console -- this file is a CLI report; stdout is the deliverable */
/**
 * WP4 repaint benchmark: how much of a pan frame is painter work that the
 * per-chart canvas cache can skip?
 *
 * Run it with Node's built-in TypeScript support (no build step, no deps):
 *
 * ```sh
 * node plugins/feature-chart/benchmark/chartRenderBenchmark.ts
 * node plugins/feature-chart/benchmark/chartRenderBenchmark.ts --json
 * ```
 *
 * ## What it measures, and what it deliberately does not
 *
 * The harness times the **synchronous JavaScript work of one whole-view
 * repaint**: payload → `ChartModel` → `paintChartModel()` for every chart in the
 * view. That is exactly the work a cache hit removes (a hit does one
 * `drawImage` instead of building the model and replaying every painter call).
 *
 * It does *not* measure GPU/rasterization: the context is a recording no-op, so
 * `fillRect`/`fill`/`stroke` cost a function call instead of pixels. That makes
 * the numbers a **lower bound** on the browser gain — in a real browser the
 * cache also skips rasterization and text layout, which this harness cannot see.
 * Canvas ops per frame are reported for scale, and the acceptance gate ("default
 * on only if the repaint drops by more than 20%") is applied to the measured JS
 * time.
 *
 * Main-thread occupancy is reported as the wall time the repaint blocks the
 * thread it runs on. In `jbrowse-web` that thread is the RPC **worker** unless
 * the app is configured with `MainThreadRpcDriver`; the number is therefore
 * "worker CPU per frame", which is what the cache is about.
 *
 * Parameters follow the WP4 issue: 100 and 300 charts, `chartWidth` 120,
 * `chartHeight` 180, `dpr` 2, a pan sequence (charts keep their model, only
 * their x changes), 8 categories × 12 observations per chart (the shape of
 * `test_data/feature-chart`).
 */

import { cpus } from 'node:os'

import { barModelFromBars } from '../src/FeatureChartDrawer/barPlot.ts'
import { boxModelFromPrecomputed } from '../src/FeatureChartDrawer/boxPlot.ts'
import {
  type ChartModel,
  DEFAULT_SERIES_NAME,
} from '../src/FeatureChartDrawer/chartModel.ts'
import { resolveColorScheme } from '../src/FeatureChartDrawer/colorSchemes.ts'
import { histogramModelFromValues } from '../src/FeatureChartDrawer/histogramPlot.ts'
import { paintChartModel } from '../src/FeatureChartDrawer/painters.ts'
import { violinModelFromTissues } from '../src/FeatureChartDrawer/violinPlot.ts'
import {
  chartCacheKey,
  chartCanvasBytes,
  clearChartRenderCache,
  colorSchemeHash,
  drawerSignature,
  getCachedChartCanvas,
  storeChartCanvas,
} from '../src/renderCache.ts'

const CHART_WIDTH = 120
const CHART_HEIGHT = 180
const DPR = 2
const CATEGORIES = 8
const OBSERVATIONS = 12
const FRAMES = 30
const WARMUP_FRAMES = 5
/** Fresh repetitions; p95 is reported for the median repetition (noise guard). */
const REPETITIONS = 3
const VIEW_WIDTH = 1200

interface Timing {
  p50: number
  p95: number
  mean: number
  min: number
  max: number
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) {
    return 0
  }
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1),
  )
  return sorted[index]!
}

function summarize(samples: number[]): Timing {
  const sorted = [...samples].sort((a, b) => a - b)
  const total = sorted.reduce((sum, value) => sum + value, 0)
  return {
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    mean: total / (sorted.length || 1),
    min: sorted[0] ?? 0,
    max: sorted[sorted.length - 1] ?? 0,
  }
}

/** A 2D context that records the calls instead of rasterizing them. */
function createNoopContext() {
  let ops = 0
  const methods = [
    'beginPath',
    'closePath',
    'fill',
    'fillRect',
    'fillText',
    'lineTo',
    'moveTo',
    'restore',
    'rotate',
    'save',
    'stroke',
    'strokeRect',
    'translate',
  ]
  const target: Record<string, unknown> = {}
  for (const method of methods) {
    target[method] = () => {
      ops++
    }
  }
  const ctx = new Proxy(target, {
    get(object, property) {
      if (property === '__ops') {
        return ops
      }
      return object[property as string]
    },
    set(object, property, value) {
      object[property as string] = value
      return true
    },
  })
  return ctx as unknown as CanvasRenderingContext2D & { __ops: number }
}

/** Deterministic pseudo-random numbers: the same data in every run. */
function makeRandom(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0x100000000
  }
}

/**
 * One chart's payload in the shape `test_data/feature-chart` uses: a
 * `precomputedBoxPlot` payload (eight categories × five-number summaries).
 * The model is what both backends consume, so this is the realistic worst case
 * for painter work (quartiles are precomputed; the violin/histogram paths are
 * measured by `--kind`).
 */
function makePayload(
  seed: number,
  kind: 'box' | 'violin' | 'bar' | 'histogram',
) {
  const random = makeRandom(seed)
  const categories = Array.from(
    { length: CATEGORIES },
    (_, index) => `Tissue ${index + 1}`,
  )
  switch (kind) {
    case 'box':
      return {
        boxes: categories.map(name => {
          const min = random() * 10
          const median = min + 1 + random() * 10
          return {
            name,
            min,
            q1: min + (median - min) * 0.4,
            median,
            q3: median + random() * 5,
            max: median + 5 + random() * 10,
          }
        }),
      }
    case 'violin':
      return {
        tissues: Object.fromEntries(
          categories.map((name, index) => [
            name,
            Array.from(
              { length: OBSERVATIONS },
              () => 5 + random() * 10 + index,
            ),
          ]),
        ),
      }
    case 'bar':
      return {
        bars: categories.map(name => ({ name, value: random() * 100 })),
      }
    case 'histogram':
      return {
        values: Array.from({ length: 120 }, () => random() * 100),
        bins: 12,
      }
  }
}

// The benchmark imports the same adapters the renderers use, so it measures the
// production model path rather than a copy of it.
const BUILDERS = {
  box: (data: unknown) => boxModelFromPrecomputed(data),
  violin: (data: unknown) => violinModelFromTissues(data),
  bar: (data: unknown) => barModelFromBars(data),
  histogram: (data: unknown) => histogramModelFromValues(data),
}

/** Charts keep their model; only their x changes as the view pans. */
function panFrames(count: number): { xs: number[] }[] {
  const frames: { xs: number[] }[] = []
  const spacing = VIEW_WIDTH / count
  for (let frame = 0; frame < FRAMES; frame++) {
    // 24 px per frame: every chart's rectangle moves, which is what would
    // invalidate a position-based cache and must not invalidate this one.
    const offset = -frame * 24
    frames.push({
      xs: Array.from({ length: count }, (_, index) => index * spacing + offset),
    })
  }
  return frames
}

const colorScheme = resolveColorScheme(undefined, 'tableau10')
const themeHash = colorSchemeHash(colorScheme)
const signature = drawerSignature('precomputedBoxPlot', {})
const geometry = `${CHART_WIDTH}x${CHART_HEIGHT}@${DPR}`
const seriesName = DEFAULT_SERIES_NAME

interface BenchmarkResult {
  charts: number
  kind: string
  before: Timing
  after: Timing
  modelBuild: Timing
  cacheHitRate: number
  canvasOpsPerFrame: number
  modelsPerFrame: number
  gainP95Percent: number
}

function runBenchmark(
  charts: number,
  kind: keyof typeof BUILDERS,
): BenchmarkResult {
  const payloads = Array.from({ length: charts }, (_, index) =>
    makePayload(index + 1, kind),
  )
  const build = BUILDERS[kind]

  // Model building is measured separately: a cache hit still has to prove the
  // model is unchanged, so this cost stays on the hot path (it is cheap and it
  // is what makes the key correct).
  const modelFrames: ChartModel[][] = []
  const modelTimes: number[] = []
  for (let frame = 0; frame < FRAMES + WARMUP_FRAMES; frame++) {
    const start = performance.now()
    const models = payloads.map(payload => build(payload))
    if (frame >= WARMUP_FRAMES) {
      modelTimes.push(performance.now() - start)
    }
    modelFrames.push(models)
  }

  const frames = panFrames(charts)
  const beforeTimes: number[] = []
  let canvasOps = 0
  for (let frame = 0; frame < FRAMES + WARMUP_FRAMES; frame++) {
    const ctx = createNoopContext()
    const models = modelFrames[frame]!
    // the pan offset itself is not part of the cache key; touch it so the
    // sequence is not optimised away
    void frames[frame % frames.length]!.xs[0]
    const start = performance.now()
    for (const [index, model] of models.entries()) {
      paintChartModel(
        {
          ctx,
          width: CHART_WIDTH,
          height: CHART_HEIGHT,
          data: payloads[index],
          name: `chart ${index}`,
          theme: undefined as never,
          colorScheme,
          feature: undefined as never,
          config: undefined as never,
          region: undefined as never,
          bpPerPx: 1,
        },
        model,
      )
    }
    const elapsed = performance.now() - start
    if (frame >= WARMUP_FRAMES) {
      beforeTimes.push(elapsed)
    }
    canvasOps = ctx.__ops
  }

  // `after`: the cache is warm after the first frame; each later frame resolves
  // the key and blits. Blitting is a no-op here, so this is the floor of the
  // real browser cost.
  clearCacheForRun()
  const afterTimes: number[] = []
  let hits = 0
  let lookups = 0
  for (let frame = 0; frame < FRAMES + WARMUP_FRAMES; frame++) {
    const models = modelFrames[frame]!
    const start = performance.now()
    for (const [index, model_] of models.entries()) {
      const model = model_
      const key = chartCacheKey({
        featureId: `feature-${index}`,
        model,
        width: CHART_WIDTH,
        height: CHART_HEIGHT,
        dpr: DPR,
        themeHash,
        drawerSignature: signature,
      })
      lookups++
      const cached = getCachedChartCanvas(key)
      if (cached) {
        hits++
        continue
      }
      storeChartCanvas(
        key,
        { width: CHART_WIDTH * DPR, height: CHART_HEIGHT * DPR } as never,
        chartCanvasBytes(CHART_WIDTH, CHART_HEIGHT, DPR),
      )
    }
    const elapsed = performance.now() - start
    if (frame >= WARMUP_FRAMES) {
      afterTimes.push(elapsed)
    }
  }

  const before = summarize(beforeTimes)
  const after = summarize(afterTimes)
  return {
    charts,
    kind,
    before,
    after,
    modelBuild: summarize(modelTimes),
    cacheHitRate: lookups === 0 ? 0 : (hits / lookups) * 100,
    canvasOpsPerFrame: canvasOps,
    modelsPerFrame: modelFrames[0]!.length,
    gainP95Percent:
      before.p95 === 0 ? 0 : ((before.p95 - after.p95) / before.p95) * 100,
  }
}

function clearCacheForRun() {
  clearChartRenderCache()
}

function format(value: number) {
  return value.toFixed(2)
}

function report(results: BenchmarkResult[]) {
  const machine = {
    node: process.version,
    platform: `${process.platform}/${process.arch}`,
    cpus: `${cpus().length}x ${cpus()[0]?.model ?? 'unknown'}`,
    chartWidth: CHART_WIDTH,
    chartHeight: CHART_HEIGHT,
    dpr: DPR,
    frames: FRAMES,
    seriesName,
    geometry,
  }
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ machine, results }, null, 2))
    return
  }
  console.log('## WP4 repaint benchmark — painter JS only (no rasterization)\n')
  console.log('```')
  for (const result of results) {
    console.log(
      `${result.charts} charts (${result.kind}, ${serie(result.charts)}):`,
    )
    console.log(
      `  model build   p50 ${format(result.modelBuild.p50)} ms  p95 ${format(result.modelBuild.p95)} ms`,
    )
    console.log(
      `  direct paint  p50 ${format(result.before.p50)} ms  p95 ${format(result.before.p95)} ms  (${result.canvasOpsPerFrame} ctx ops/frame)`,
    )
    console.log(
      `  cached        p50 ${format(result.after.p50)} ms  p95 ${format(result.after.p95)} ms  (${result.cacheHitRate.toFixed(1)}% hits)`,
    )
    console.log(`  p95 gain      ${result.gainP95Percent.toFixed(1)}%`)
    console.log('')
  }
  console.log('```')
  console.log('Machine:', JSON.stringify(machine))
}

function serie(charts: number) {
  return `${charts * CHART_WIDTH}x${CHART_HEIGHT}px`
}

const kinds = (process.argv
  .find(arg => arg.startsWith('--kind='))
  ?.split('=')[1] ?? 'box') as keyof typeof BUILDERS
const results = [100, 300].map(charts => {
  const runs = Array.from({ length: REPETITIONS }, () =>
    runBenchmark(charts, kinds),
  )
  // Pick the median repetition by p95 gain: a single run on a busy machine can
  // swing by tens of percent, and the gate is a percentage.
  const sorted = [...runs].sort((a, b) => a.gainP95Percent - b.gainP95Percent)
  return sorted[Math.floor(sorted.length / 2)]!
})
report(results)
