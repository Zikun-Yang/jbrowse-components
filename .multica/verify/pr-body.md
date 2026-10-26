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

## Follow-up: `drawerOptions` typo warning + drawer payload guard

Review feedback on MK-18 ("未知键 dev warn 可以，需要检查要获取的 data 是否都能正常获取")
turned into a fourth commit.

**`drawerOptions` unknown keys now warn (development only).**
`meta.optionsSchema` is the key set: an object contributes its keys, an array its
string entries, `{}`/`[]` means "reads no options", absent means undeclared and
stays silent (so a plugin that never shipped a schema is not punished with console
noise). The built-ins declare `{}`, which is what makes `drawerOptions` written
against `barPlot` reportable instead of silently ignored. Warns once per drawer
and key set, from both call sites that paint — the RPC worker's in-track canvas
and the maximize dialog — so a track with 40 charts logs one line per context.

**`devMode.ts`: the old dev check was dead code in the browser.** Webpack
substitutes `process.env.NODE_ENV` with a literal but does not polyfill `process`
(a page evaluation reports `typeof process === 'undefined'` while the bundle
contains no `process.env.NODE_ENV`). The `typeof process !== 'undefined' && …`
pattern copied from `packages/core/src/util/renderTemplate.ts` therefore evaluates
to `false` in exactly the development build, so no warning could ever fire. Fixed
locally for this plugin (including `drawerRegistry`'s override/namespace
warnings); the core helper still has the same trap.

**The drawer payload is user data.** `DrawerProps.data` is the JSON parsed out of
the TSV `data` column, so it can be `null`, a primitive, or missing entirely (a
feature without `contextData`), and one junk entry (`boxes: [null]`,
`tissues: {Brain: null}`) used to throw inside the canvas callback, which fails
the whole track in the worker. All built-ins now read through `asDrawerData()`
and filter to finite numbers; malformed input paints nothing.

Tests added: `drawerOptions.test.ts` (key set, unknown keys, warn-once, silence
for undeclared schemas), `devMode.test.ts` (including a runtime without
`process`), `drawerData.test.ts` (every reachable drawer survives
missing/primitive/malformed payloads and still paints the payload it declares),
`demoDataContract.test.ts` (the demo TSVs exist, every row carries the key its
configured drawer reads, the drawer paints it, and no demo track trips the new
warning), plus a render-level unknown-key warning case and a no-payload case in
`renderFeatureChart.test.ts`.

`plugins/feature-chart`: 23 suites / 156 tests green (was 19 / 105). `eslint`
clean, `tsc --noEmit` unchanged at the repo baseline (32 errors, none in this
plugin). Browser: the new `verify-warn.mjs` (typo'd key + a track whose `data`
column is literally `null`) passes 8/8, and the original WP2 browser suite still
passes 10/10 — including the worker path.
