WP2 of the feature-chart work: plugin-contributed drawers + `drawerOptions`.

Built on `main` (WP0/WP1 already merged), three commits, no unrelated changes.

## Why the old registration snippet could not work

An external plugin is a separate ES module graph. Bundled or not, it gets its own
copy of `drawerRegistry.ts`, so `registerFeatureChartDrawer()` from a plugin
succeeds into a Map nobody reads — no error, no drawer. The registry has to be
`PluginManager`-scoped, and the interface has to be an extension point.

## What this changes

1. **`Core-featureChartDrawer` extension point + per-`PluginManager` catalog**
   - merged catalog = module registry (built-ins) + `evaluateExtensionPoint(...)`,
     cached in a `WeakMap`, invalidated by a registry epoch or
     `clearFeatureChartDrawerCache(pm)`
   - `getFeatureChartDrawer/getFeatureChartDrawerMeta/listFeatureChartDrawers/
     listFeatureChartDrawerNames/resolveFeatureChartDrawer` all take an optional
     `pluginManager`; the legacy module-scoped calls are unchanged
   - later entry wins an equal name (dev warning), built-ins are overridable,
     non-namespaced names warn, malformed contributions are skipped, and a
     plugin that forgets to spread the extendee cannot erase the built-ins
2. **`drawerOptions`** — a `frozen` slot on both renderers, passed to the drawer
   as `DrawerProps.options` (always an object). Unvalidated by design; drawers
   default/clamp and document the keys via `meta.optionsSchema`.
3. **Worker path** — the canvas renderer resolves drawers with the worker's own
   `PluginManager`, the maximize canvas/dialog with `getEnv(displayModel)`. No
   `MainThreadRpcDriver` fallback anywhere.
4. **Missing-plugin diagnostics** — a `plugin/drawer` name that is not registered
   now says that a plugin is missing and which one to add to `config.plugins`,
   distinguishes "plugin loaded but no such drawer", and suggests close matches.
5. **Runnable example** — `test_data/feature-chart/plugins/sampleChartDrawers.js`
   (no build step, no imports) with two drawers, wired into the demo config with
   two plugin tracks plus a missing-plugin track.
6. **Docs** — `website/docs/developer_guides/feature_chart_drawers.md`,
   `extension_points.md` entry, `FeatureChartTrack.md` §3.5 and
   `ARCHITECTURE.md` rewritten for the pluginManager-scoped catalog (incl. the
   "when to upgrade to a first-class `DrawerType`" criterion).

## Verification

- `plugins/feature-chart`: 19 suites / 105 tests green; eslint clean; `tsc`
  has zero errors in the changed files (repo baseline unchanged at 32).
- `pnpm configdocs` is reproducible (zero diff after regenerate + prettier).
- Real browser (webpack dev server, default `WebWorkerRpcDriver`) with the demo
  config, checked via puppeteer:
  - plugin installs on the main thread **and in all four RPC workers**
    (`globalThis.__sampleChartDrawers.context === 'worker'`)
  - the worker-painted track canvas contains the plugin heatmap ramp and the dot
    plot colors (no placeholder)
  - maximize dialog paints both plugin drawers with their `drawerOptions`
  - the missing-plugin track shows the "Missing plugin? … add \"notLoadedPlugin\"
    to config.plugins" alert with a suggestion

Screenshots: in the issue comment on MK-18.
