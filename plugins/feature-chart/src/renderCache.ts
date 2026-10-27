import { serializeChartModel } from './FeatureChartDrawer/chartModel.ts'

import type { ChartModel } from './FeatureChartDrawer/chartModel.ts'
import type { FeatureChartColorScheme } from './FeatureChartDrawer/colorSchemes.ts'

/**
 * Per-chart canvas cache for the canvas renderer.
 *
 * Panning and zooming re-runs `renderFeatureChart()` for the whole view, and
 * before WP4 every chart was repainted from scratch every frame — including the
 * quartiles, the KDE and the tick layout, which do not depend on the view.
 * Measured first (`benchmark/chartRenderBenchmark.ts`, results in the WP4 issue
 * comment), cached second.
 *
 * The key is `(featureId, modelHash, width, height, dpr, themeHash,
 * drawerSignature)`:
 *
 * - `modelHash` is `serializeChartModel()`, so a payload change misses;
 * - `width`/`height`/`dpr` cover resize and moving between screens;
 * - `themeHash` covers light/dark and `colorScheme` changes;
 * - `drawerSignature` covers `drawer` + `drawerOptions` changes.
 *
 * Everything that changes pixels is in the key; anything that does not (pan
 * position) is not, which is what makes a hit possible at all.
 *
 * The cache is **optional and capability-detected**: `OffscreenCanvas` in
 * workers/Chrome, a detached `<canvas>` on the main thread, and nothing at all
 * in environments with neither (old browsers, jsdom) — in which case the
 * renderer paints directly, exactly as before.
 */

/** 128 MiB: enough for ~300 charts at 120x180 @ dpr 2 (≈345 KB each). */
export const DEFAULT_CACHE_MAX_BYTES = 128 * 1024 * 1024

export type ChartCanvas = OffscreenCanvas | HTMLCanvasElement

interface CacheEntry {
  canvas: ChartCanvas
  bytes: number
}

export interface ChartRenderCacheStats {
  entries: number
  bytes: number
  hits: number
  misses: number
  evictions: number
}

class ChartCanvasCache {
  private entries = new Map<string, CacheEntry>()
  private bytes = 0
  private hits = 0
  private misses = 0
  private evictions = 0

  private readonly maxBytes: number

  constructor(maxBytes = DEFAULT_CACHE_MAX_BYTES) {
    this.maxBytes = maxBytes
  }

  get(key: string): ChartCanvas | undefined {
    const entry = this.entries.get(key)
    if (!entry) {
      this.misses++
      return undefined
    }
    // Re-insert to move the entry to the LRU tail.
    this.entries.delete(key)
    this.entries.set(key, entry)
    this.hits++
    return entry.canvas
  }

  set(key: string, canvas: ChartCanvas, bytes: number) {
    const existing = this.entries.get(key)
    if (existing) {
      this.bytes -= existing.bytes
      this.entries.delete(key)
    }
    this.entries.set(key, { canvas, bytes })
    this.bytes += bytes
    // A single chart larger than the budget is still worth keeping: evicting it
    // immediately would turn every render into a full repaint.
    if (bytes > this.maxBytes) {
      return
    }
    for (const [oldKey, entry] of this.entries) {
      if (this.bytes <= this.maxBytes) {
        break
      }
      if (oldKey === key) {
        continue
      }
      this.entries.delete(oldKey)
      this.bytes -= entry.bytes
      this.evictions++
    }
  }

  clear() {
    this.entries.clear()
    this.bytes = 0
    this.hits = 0
    this.misses = 0
    this.evictions = 0
  }

  stats(): ChartRenderCacheStats {
    return {
      entries: this.entries.size,
      bytes: this.bytes,
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
    }
  }
}

let cache: ChartCanvasCache | undefined

function getCache() {
  cache ??= new ChartCanvasCache()
  return cache
}

/** Test/ops hook: drop every cached chart (memory, session teardown). */
export function clearChartRenderCache() {
  cache?.clear()
}

export function chartRenderCacheStats(): ChartRenderCacheStats {
  return getCache().stats()
}

/**
 * `true` when this runtime can paint into a detached, non-DOM canvas.
 *
 * The renderer that matters here is the canvas renderer in the **RPC worker**,
 * where `OffscreenCanvas` is the only detached canvas; the main-thread driver
 * (and jsdom) has no `OffscreenCanvas`, so it keeps the pre-WP4 direct-paint
 * path. That is the intended capability gate: no polyfill, no `<canvas>`
 * fallback, no "sometimes cached" behaviour to reason about.
 */
export function chartCacheSupported(): boolean {
  return typeof OffscreenCanvas !== 'undefined'
}

export function createChartCanvas(
  width: number,
  height: number,
): { canvas: ChartCanvas; ctx: CanvasRenderingContext2D } | undefined {
  if (!chartCacheSupported()) {
    return undefined
  }
  try {
    const canvas = new OffscreenCanvas(
      Math.max(1, Math.round(width)),
      Math.max(1, Math.round(height)),
    )
    const ctx = canvas.getContext(
      '2d',
    ) as unknown as CanvasRenderingContext2D | null
    return ctx ? { canvas, ctx } : undefined
  } catch {
    // A canvas that cannot be allocated must not take the track down.
    return undefined
  }
}

export function getCachedChartCanvas(key: string): ChartCanvas | undefined {
  return getCache().get(key)
}

export function storeChartCanvas(
  key: string,
  canvas: ChartCanvas,
  bytes: number,
) {
  getCache().set(key, canvas, bytes)
}

/** Estimated bitmap memory of one cached chart. */
export function chartCanvasBytes(width: number, height: number, dpr: number) {
  return (
    Math.max(1, Math.round(width * dpr)) *
    Math.max(1, Math.round(height * dpr)) *
    4
  )
}

/** Stable hash of a resolved palette (theme + `colorScheme` slot). */
export function colorSchemeHash(scheme: FeatureChartColorScheme): string {
  return `${scheme.name}|${scheme.background}|${scheme.grid}|${scheme.axis}|${scheme.text}|${scheme.colors.join(',')}`
}

/**
 * Cache key for one chart. Both halves of the key are stable across runtimes:
 * `modelHash` is an explicit-order JSON serialization, `drawerSignature` is a
 * JSON of the drawer name and options in key order.
 */
export function chartCacheKey({
  featureId,
  model,
  width,
  height,
  dpr,
  themeHash,
  drawerSignature,
}: {
  featureId: string
  model: ChartModel
  width: number
  height: number
  dpr: number
  themeHash: string
  drawerSignature: string
}): string {
  return [
    featureId,
    hashString(serializeChartModel(model)),
    `${Math.round(width)}x${Math.round(height)}@${dpr}`,
    themeHash,
    drawerSignature,
  ].join('|')
}

/** JSON with sorted keys, so two equal option objects hash identically. */
export function drawerSignature(
  drawer: string,
  options: Record<string, unknown>,
): string {
  return `${drawer}|${stableStringify(options)}`
}

export function stableStringify(value: unknown): string {
  if (value === undefined || value === null || typeof value !== 'object') {
    // `JSON.stringify(undefined)` is `undefined`; keep the result valid JSON.
    return value === undefined ? 'null' : JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return `[${value.map(item => stableStringify(item)).join(',')}]`
  }
  const entries = Object.keys(value as Record<string, unknown>)
    .sort()
    .map(
      key =>
        `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`,
    )
  return `{${entries.join(',')}}`
}

/**
 * FNV-1a 32-bit: cheap, allocation-free, and only ever used to keep keys short
 * (the full model string is *not* stored in the key). Collisions would show a
 * stale chart, so the key also carries the feature id and geometry; a collision
 * would need the same feature, same size, same theme and a different model that
 * hashes equal — the practical risk is negligible for a render cache.
 */
export function hashString(value: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16)
}
