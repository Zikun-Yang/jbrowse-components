import { getConf } from '@jbrowse/core/configuration'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

/**
 * One per-track override of a renderer config slot.
 *
 * Track overrides are display-scoped values (e.g. `trackShowLabels`) that
 * shadow a renderer config slot for the current session without editing the
 * track configuration. Each override needs the same four pieces of plumbing,
 * all generated from a single table entry:
 *
 * 1. a public getter (`showLabels`) falling back to the renderer config,
 * 2. an entry in `rendererConfig` so the renderer sees the override,
 * 3. an action writing it (`toggleShowLabels` / `setDisplayMode`),
 * 4. snapshot pruning so an unset override is not persisted in the session.
 *
 * Adding an override is then one table entry plus the `trackXxx` property on
 * the MST model (property declaration cannot be generated).
 */
export interface TrackOverride {
  /** MST property holding the override, e.g. `trackShowLabels` */
  trackProp: string
  /** public getter, e.g. `showLabels` */
  getter: string
  /** renderer config slot that the override shadows */
  slot: string
  /** action writing the override, e.g. `setDisplayMode` */
  action: string
  /** `toggle` flips the current value, `set` takes the new value */
  kind: 'toggle' | 'set'
}

// the generated plumbing only touches these props through dynamic keys;
// `configuration` is required so the getters can call getConf
interface OverrideHost {
  configuration: AnyConfigurationModel
  [key: string]: any
}

/**
 * Define the config-fallback getters on a `views()` object.
 *
 * Accessors are used (and defined in place) because a plain function would be
 * treated as a method by MST, and spreading the result would evaluate the
 * getters before the model instance exists.
 */
export function trackOverrideViews<TViews extends object>(
  views: TViews,
  overrides: readonly TrackOverride[],
  self: OverrideHost,
): TViews {
  for (const { trackProp, getter, slot } of overrides) {
    if (getter in views) {
      continue
    }
    Object.defineProperty(views, getter, {
      enumerable: true,
      configurable: true,
      get: () => self[trackProp] ?? getConf(self, ['renderer', slot]),
    })
  }
  return views
}

/**
 * Add the override actions to an `actions()` object. Toggle actions flip the
 * value the getter currently reports; set actions store the given value.
 *
 * `trackOverrideActions<MyActions>({...}, overrides, self)` keeps the action
 * names typed at the call sites while the implementations are generated.
 */
export function trackOverrideActions<TActions extends object>(
  actions: TActions,
  overrides: readonly TrackOverride[],
  self: OverrideHost,
): TActions {
  const target = actions as Record<string, (...args: any[]) => void>
  for (const { trackProp, getter, action, kind } of overrides) {
    if (action in actions) {
      continue
    }
    target[action] =
      kind === 'toggle'
        ? () => {
            self[trackProp] = !self[getter]
          }
        : (value: unknown) => {
            self[trackProp] = value
          }
  }
  return actions
}

/**
 * Merge the active track overrides over the renderer config so that renderers
 * see exactly the values the menus display.
 */
export function withTrackOverrides<T extends object>(
  overrides: readonly TrackOverride[],
  self: OverrideHost,
  rendererConfig: T,
): T {
  const merged: Record<string, unknown> = { ...(rendererConfig as object) }
  for (const { trackProp, slot } of overrides) {
    merged[slot] = self[trackProp] ?? (rendererConfig as OverrideHost)[slot]
  }
  return merged as T
}

/**
 * Drop undefined overrides from a snapshot. MST stores `undefined` for unset
 * `types.maybe` properties, and a persisted `trackShowLabels: undefined` would
 * keep shadowing the config even after the track configuration changes.
 */
export function pruneTrackOverrides<T extends object>(
  overrides: readonly TrackOverride[],
  snapshot: T,
): T {
  const pruned: Record<string, unknown> = { ...(snapshot as object) }
  for (const { trackProp } of overrides) {
    const value = pruned[trackProp]
    delete pruned[trackProp]
    if (value !== undefined) {
      pruned[trackProp] = value
    }
  }
  return pruned as T
}
