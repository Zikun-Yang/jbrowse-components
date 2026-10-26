import { isDevelopmentBuild } from './devMode.ts'

import type { FeatureChartDrawerMeta } from './types.ts'

/**
 * Development-only diagnostics for `renderer.drawerOptions`.
 *
 * The slot is `frozen` and deliberately **not validated**: a typo must not make
 * a config unloadable, and drawers are still required to default and clamp
 * every key. The one failure mode that is worth a warning is a key the drawer
 * never reads, because it shows up as "my option does nothing" with no other
 * signal at all.
 *
 * The only source of truth for "which keys does this drawer read" is
 * `meta.optionsSchema`, which drawers already publish as documentation:
 *
 * - `{ colorRamp: 'cool | warm', cellGap: 'px, 0-6' }` — object form, its keys
 *   are the accepted option names.
 * - `['colorRamp', 'cellGap']` — array form, for plugins that do not want to
 *   write descriptions.
 * - `{}` (or `[]`) — "this drawer reads no options"; the built-ins declare this
 *   so putting `drawerOptions` on i.e. `barPlot` is reported instead of silently
 *   ignored.
 * - absent/`null` — undeclared. Nothing is warned: a plugin that never shipped
 *   an `optionsSchema` should not become a source of console noise.
 */

const warnedMessages = new Set<string>()

/** Log once per message, and only in development builds. */
function warnOnce(message: string) {
  if (!isDevelopmentBuild() || warnedMessages.has(message)) {
    return
  }
  warnedMessages.add(message)
  console.warn(`[feature-chart] ${message}`)
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/**
 * Option names a drawer declares, or `undefined` when it declares nothing (in
 * which case `drawerOptions` cannot be checked at all). An empty array means
 * "declares no options", which is checkable: every key is unknown.
 */
export function getDrawerOptionKeys(
  meta?: Pick<FeatureChartDrawerMeta, 'optionsSchema'> | null,
): string[] | undefined {
  const schema = meta?.optionsSchema
  if (Array.isArray(schema)) {
    return schema.filter(
      (key): key is string => typeof key === 'string' && key.length > 0,
    )
  }
  if (isPlainObject(schema)) {
    return Object.keys(schema)
  }
  return undefined
}

/** `drawerOptions` keys the drawer does not declare, sorted and deduplicated. */
export function findUnknownDrawerOptions(
  meta: Pick<FeatureChartDrawerMeta, 'optionsSchema'> | null | undefined,
  options: unknown,
): string[] {
  const declared = getDrawerOptionKeys(meta)
  if (declared === undefined || !isPlainObject(options)) {
    return []
  }
  const known = new Set(declared)
  return [...new Set(Object.keys(options))]
    .filter(key => !known.has(key))
    .sort()
}

function formatKeys(keys: string[]) {
  return keys.map(key => `"${key}"`).join(', ')
}

/**
 * Warn (once per drawer + key set, development only) about `drawerOptions`
 * entries the resolved drawer does not declare. Returns the unknown keys so
 * callers/tests do not have to spy on the console.
 */
export function warnUnknownDrawerOptions(
  meta:
    | Pick<FeatureChartDrawerMeta, 'name' | 'optionsSchema'>
    | null
    | undefined,
  options: unknown,
): string[] {
  const unknown = findUnknownDrawerOptions(meta, options)
  if (!meta || unknown.length === 0) {
    return unknown
  }
  const declared = getDrawerOptionKeys(meta)
  const message =
    declared && declared.length > 0
      ? `drawer "${meta.name}" ignores unknown drawerOptions ${formatKeys(unknown)}; it reads: ${declared.join(', ')}`
      : `drawer "${meta.name}" reads no drawerOptions, ignoring ${formatKeys(unknown)}`
  warnOnce(message)
  return unknown
}
