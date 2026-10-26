# FeatureChartTrack architecture (WP0 contract)

This document is the contract other work packages build on. It covers the drawer
catalog, the failure semantics, the config boundary, plugin-contributed drawers
(WP2, landed), declarative chart specs and the normalized `ChartModel` (WP3,
landed), and the seams left open for WP4 (renderer model unification) and WP5
(agent-sdk fields).

The user-facing vocabulary is [`SPEC.md`](./SPEC.md); this file explains how it
is built.

Requirements, data formats and config examples live in
[`FeatureChartTrack.md`](./FeatureChartTrack.md).

## Layers

```
FeatureChartTrack            (TrackType)
  └─ LinearFeatureChartDisplay        (DisplayType, BaseLinearDisplay)
       └─ FeatureChartRenderer        (canvas / D3, runs in the RPC worker)
       └─ FeatureChartPlotlyRenderer  (DOM / Plotly, runs on the main thread)
            └─ FeatureChartTabixAdapter (TSV+tabix -> features with contextData)
```

The plugin is registered by all three products (`products/jbrowse-web`,
`products/jbrowse-desktop`, `products/jbrowse-react-app`) through their
`src/corePlugins.ts`. The RPC worker reuses the same module
(`packages/product-core/src/rpcWorker.ts`), so `install()` — and therefore
`initBuiltInDrawers()` — runs in both contexts. The drawer registry is a
module-level singleton per context; nothing is serialized across the boundary.

## Drawer catalog

`src/FeatureChartDrawer/drawerRegistry.ts` owns a `Map<string, { meta, draw }>`
for the module instance, and derives a **per-`PluginManager` catalog** from it
by merging what plugins contribute through the `Core-featureChartDrawer`
extension point. `meta` is the serializable, enumerable part; `draw` is the
function.

```ts
interface FeatureChartDrawerMeta {
  name: string
  displayName: string
  description: string // one sentence: what it draws and what it eats
  dataShape:
    | 'summary-stats'
    | 'grouped-values'
    | 'category-values'
    | 'values'
    | 'any'
  defaultSize?: { width: number; height: number }
  optionsSchema?: unknown // keys the drawer reads: { key: 'doc' } | ['key']; {} = reads none; absent = undeclared
}
```

`dataShape` uses the **same spelling as the chart-spec forms** (WP3 renamed it
from `tissues`/`matrix`/`series`, because two vocabularies for one shape is how
a catalog and a config start lying to each other). A drawer that still declares
an old name is treated as `any` and gets a development warning rather than
failing.

| dataShape         | meaning                                            |
| ----------------- | -------------------------------------------------- |
| `summary-stats`   | per-category precomputed five-number summaries     |
| `grouped-values`  | per-category arrays of raw observations            |
| `category-values` | one number per category                            |
| `values`          | one flat numeric series                            |
| `any`             | custom drawers that do not want to declare a shape |

Public API (also re-exported from the package root). Every lookup takes an
optional `pluginManager`; pass it to include plugin-contributed drawers:

- `getFeatureChartDrawer(name, pluginManager?)` — the draw function, or
  `undefined`.
- `getFeatureChartDrawerMeta(name, pluginManager?)` — catalog entry.
- `listFeatureChartDrawers(pluginManager?)` /
  `listFeatureChartDrawerNames(pluginManager?)` — sorted by `name` with a plain
  `<` comparison (no `localeCompare`), so ordering is identical in every worker,
  browser and test run.
- `resolveFeatureChartDrawer(name, pluginManager?)` — `{ drawer, meta }` or
  `{ error, available, missingPlugin?, pluginLoaded?, suggestions? }`; never
  throws.
- `clearFeatureChartDrawerCache(pluginManager?)` — drop the cached merged
  catalog for one plugin manager, or all of them when called without arguments.
- `initBuiltInDrawers()` — registers the five built-ins; idempotent and called
  from `FeatureChartPlugin.install()`.
- `registerFeatureChartDrawer(name, draw, meta?)` — **legacy**, only for code
  that shares this module instance (built-ins, in-repo callers, tests). See "Why
  plugins cannot import this module" below.

### Why the catalog is scoped to the PluginManager

An external plugin is a separate ES module graph. Even bundled, it carries its
own copy of `drawerRegistry.ts`, so its module-level `Map` is not the host's:
`registerFeatureChartDrawer` would "succeed" into a map nobody reads, with no
error. The only shared channel is the `PluginManager`, hence:

```ts
pluginManager.addToExtensionPoint('Core-featureChartDrawer', drawers => [
  ...drawers,
  { name: 'myPlugin/heatmap', draw },
])
```

`getCatalog(pluginManager)` evaluates that extension point with the module
registry's contributions as the extendee, applies the returned entries in order
(later wins) and caches the result in a `WeakMap` keyed by the plugin manager.
The module registry stays the base, so a plugin that returns a list without
spreading the extendee cannot erase the built-ins.

Cache invalidation:

- `registerFeatureChartDrawer` / `initBuiltInDrawers` bump a module-level epoch;
  every cached catalog compares against it and rebuilds lazily.
- `clearFeatureChartDrawerCache(pm)` forces one plugin manager to rebuild (hot
  reload, or a test that adds a callback after `configure()`).

### Registration semantics

- **Naming.** Plugin drawers should be `pluginName/drawerName`. A contribution
  without a prefix that is not an existing built-in logs a dev warning; nothing
  is rejected (the catalog stays usable).
- **Overrides.** An equally named later entry wins, and a dev build logs
  `drawer "<name>" was overridden by a plugin`. Built-in names are not reserved,
  because a site may legitimately want its own `barPlot`.
- **Robustness.** Entries that are not objects, have no `name`, or have no
  `draw` function are skipped with a dev warning, and an invalid `dataShape` is
  coerced to `'any'`. A no-build plugin is plain JS, so the catalog must not
  trust its own input.

Built-ins: `precomputedBoxPlot` (default), `rawBoxPlot`, `rawViolinPlot`,
`barPlot`, `histogram`.

## Chart model and painters (WP3)

Before WP3, five drawers each carried a full copy of the canvas code. Adding the
declarative renderer on top of that would have meant a sixth copy, and "the spec
draws the same thing as `rawBoxPlot`" would have been a promise nobody could
keep. So the drawing code moved into one place and every drawer became an
adapter:

```
feature payload ─┬─▶ legacy adapter (boxPlot.ts, barPlot.ts, …) ─┐
                 │                                              ├─▶ ChartModel ─▶ painters.ts ─▶ canvas
renderer.spec ───┴─▶ normalizeFromSpec() ───────────────────────┘
```

| file              | role                                                                                                                       |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `chartModel.ts`   | `ChartModel` (kind, categories, one series of datums, style, axes) + a stable `serializeChartModel()` / `chartModelHash()` |
| `chartSpec.ts`    | vocabulary, legality matrix, `validateChartSpec()`, `normalizeFromSpec()`, `resolveDataPath()`                             |
| `statistics.ts`   | quartiles / 1.5·IQR summary / KDE, shared by the box and violin painters                                                   |
| `painters.ts`     | one painter per kind + the shared frame (background, grid, axes, y label)                                                  |
| `boxPlot.ts` etc. | payload → model adapters; the public drawer names                                                                          |
| `specDrawer.ts`   | the `spec` drawer: paints `DrawerProps.model` or a spec placeholder                                                        |

Consequences worth knowing:

- **Equivalence is structural.** A legacy drawer and its spec preset build the
  same model, so they paint the same thing. `specEquivalence.test.ts` asserts it
  by comparing the full call trace (arguments + canvas state), not a pixel
  count.
- **Empty means empty.** A model with no data draws nothing at all — no panel,
  no axes — which is the pre-WP3 behaviour and what `drawerData.test.ts` pins.
- **`axes.yLabel` is the only added drawing.** It widens the left margin by a
  constant and draws one rotated text; without it the trace is identical.
- **Only the renderer resolves.** `renderFeatureChart()` validates the spec once
  per render (structural errors ⇒ one placeholder for the whole width), then
  normalizes per feature (data errors ⇒ one placeholder for that chart).
  `DrawerProps.model` / `modelErrors` carry the result, so the drawer never
  parses config.

### The spec drawer protocol

```
renderer (worker)                          drawer
validateChartSpec(spec) ─── errors ──▶  placeholder across the render width,
                                          specError in the RPC result
normalizeValidatedSpec(spec, data) ──▶  props.model      ──▶ paintChartModel()
                           └── errors ─▶  props.modelErrors ──▶ placeholder
```

`drawer: "spec"` is therefore _not_ an ordinary drawer that parses its own
config: the renderer owns validation (so the diagnosis is track-wide when it
should be and per-chart when it should be), and the drawer owns painting. Third
parties invoking the drawer directly must pass a model; plugin drawers keep
reading `data`.

`FeatureChartPlotlyRenderer` accepts the `spec` slot (so switching renderers
does not lose config) and refuses to render it, with an explicit "not supported
here" message. Unifying both backends is WP4; a Plotly-only kind would paint
nothing in the track, which is the inconsistency WP4 exists to remove.

## Failure semantics

An unknown, empty or unregistered drawer name must never fail the track. A
worker-level throw marks the whole track as errored and hides every other chart,
which is exactly what the old code did.

- `resolveFeatureChartDrawer()` returns `{ error, available }` instead of
  throwing.
- `renderFeatureChart()` draws a readable placeholder for the whole render
  width: panel background, warning border, the error text and the first five
  available drawer names. It logs `console.warn('[feature-chart] <error>')` and
  returns `drawerError` in the RPC result value.
- `MaximizeDialog` shows the same information in an MUI `Alert`
  (`severity="warning"`) instead of silently rendering an empty dialog. The
  markdown description stays visible and "Zoom to region" / "Close" keep
  working.
- An explicitly empty `drawer` value is treated as "not configured" by
  `resolveFeatureChartRenderSettings()` and falls back to the schema default
  (`precomputedBoxPlot`).

## Why the renderer reads only its own config

Before WP0 the display copied chart settings into the render props:

```ts
// previous (removed) LinearFeatureChartDisplay.renderProps()
return { ...superProps, config: self.rendererConfig, drawer: getConf(...), chartWidth: ... }
```

while the renderer also received `config`. Two sources for the same value meant
that a slot added to the renderer schema did nothing until the display learned
to copy it, and a stale render prop could silently win over the config.

Decision: **renderers resolve every chart setting from `renderProps.config`**
via `src/renderSettings.ts`:

```ts
resolveFeatureChartRenderSettings(config): {
  drawer, drawerOptions, chartWidth, chartHeight, align,
  maxChartsPerView, minChartSpacingPx, colorScheme,
}
```

`RenderArgsDeserialized` already carries `config`, so nothing extra is
serialized into the worker. The settings resolver accepts both a live config
model and a plain snapshot (what arrives in the worker) and falls back to the
schema defaults for missing or malformed values.

Consequences:

- Adding a renderer slot (WP2/WP3) is a one-file change: schema +
  `renderSettings.ts` (+ the drawing code). The display does not change.
- `LinearFeatureChartDisplay.renderProps()` only adds `config` and `theme`.
  `bpPerPx` and the other base render props still come from
  `superRenderProps()`.
- The display still owns what is display-level: `rendererTypeName` and the track
  row `height` (which reads `renderer.chartHeight`).

Guard: `renderFeatureChart.test.ts` calls `renderFeatureChart()` with a
config-only `renderProps` object and asserts the drawer receives the width,
height and palette from config, and that the returned chart height matches
config. `renderSettings.test.ts` pins the slot mapping, the `drawerOptions`
sanitizing (non-objects become `{}`) and the other fallbacks.

## `drawerOptions`

`drawerOptions` is a `frozen` slot on both renderers, resolved by
`renderSettings.ts` and passed to the drawer as `DrawerProps.options` (always an
object, `{}` when unset). It is intentionally **not validated**:

- the config editor does not check it, and `meta.optionsSchema` is documentation
  only, so adding a knob never requires a schema migration;
- a wrong value shows up as a wrong-looking chart, not an error, which is why
  the developer guide requires drawers to default and clamp every key;
- the canvas renderer and the maximize canvas read the same slot from the
  display's renderer config, so both stay identical.

`FeatureChartPlotlyRenderer` declares the slot as well, so switching renderers
keeps a track's configuration intact, but the Plotly backend chooses its chart
with `plotType` and does not consume drawers until WP4 unifies both backends.

### Unknown keys warn in development

`drawerOptions.ts` turns the one silent failure mode that is left — "the key I
wrote is never read" — into a development `console.warn`, without validating
anything at runtime:

```ts
getDrawerOptionKeys(meta) // string[] | undefined
findUnknownDrawerOptions(meta, o) // sorted unknown keys, no side effects
warnUnknownDrawerOptions(meta, o) // …and one dev-only warn per drawer + key set
```

The key set comes from `meta.optionsSchema`, read leniently: an object
contributes its keys, an array its string entries, `{}`/`[]` mean "reads no
options", and an **absent schema means undeclared → no warning at all**, so a
plugin that never shipped a schema is not punished with console noise. The
built-ins declare `{}` on purpose, which is what makes `drawerOptions` on
`barPlot` reportable instead of silently ignored.

Call sites are the two places that paint: `renderFeatureChart()` (so the warning
appears in the worker console that actually renders the chart) and `ChartCanvas`
in the maximize dialog. Both use `warnOnce`-style dedupe, per context, so a
track with 40 charts still logs one line. Two contexts therefore means two lines
for a whole page, which is what the browser check asserts.

`devMode.ts` exists because the obvious dev check does not work here. Webpack
substitutes **`process.env.NODE_ENV`** with a literal, but does not polyfill
`process`; in `jbrowse-web` a page evaluation reports
`typeof process === 'undefined'` while the bundle contains no
`process.env.NODE_ENV` at all. A guard written as
`typeof process !== 'undefined' && process.env.NODE_ENV !== 'production'` (the
pattern also used by `packages/core/src/util/renderTemplate.ts`) therefore
short-circuits to `false` and disables every warning in exactly the development
build. `isDevelopmentBuild()` reads the expression directly and falls back to
"not production" when neither the substitution nor `process` exists, so
`drawerRegistry.ts`'s override warnings work in the browser too.

### The drawer payload is user data

`DrawerProps.data` is the JSON parsed out of the feature's `data` column. It can
legitimately be `null`, a number, a string, or missing entirely (a feature
without `contextData`), and a single bad entry (`boxes: [null]`,
`tissues: {Brain: null}`) is enough to throw. Drawers therefore read it through
`asDrawerData()` (`drawerData.ts`), which answers `{}` for anything that is not
a plain object; each `normalize*()` in the built-ins filters to finite numbers
before computing a scale. `drawerData.test.ts` runs **every reachable drawer**
against missing/odd payloads, and `demoDataContract.test.ts` asserts the demo
TSVs actually carry the key each configured drawer reads.

## Color scheme

`src/FeatureChartDrawer/colorSchemes.ts` owns the palettes (`tableau10`,
`viridis`, `set2`, `dark2`, `blues`) and `resolveColorScheme(theme, name)`:

- Colors are always `#rrggbb`, because drawers build translucent fills with
  `color + '33'`.
- `theme.palette.mode === 'dark'` switches the panel chrome to a dark palette
  and lightens every palette color, so dark entries (viridis, blues) stay
  visible on the dark panel.
- Unknown names fall back to `tableau10` and warn once per name (not once per
  rendered chart).
- Renderers resolve the scheme once and pass it to drawers as
  `DrawerProps.colorScheme`; drawers fall back to the default scheme when it is
  omitted, so direct/test calls keep working. Plotly uses the same scheme for
  trace colors and `layout.colorway`.

Both `FeatureChartRenderer.colorScheme` and
`FeatureChartPlotlyRenderer.colorScheme` are now live slots — the former dead
config is gone instead of being documented away.

## Local scale primitives

`src/FeatureChartDrawer/scales.ts` provides the two primitives the drawers need
(`scaleBand`, `scaleLinear`) with d3-compatible math (band padding, centered
bands, reversed ranges, `nice()` on a 10-tick step, d3 tick-step thresholds) and
`tickValues()`.

`d3-scale` v4 is ESM-only. Because this plugin is now imported by every product
entry point, a static `d3-scale` import made the product jest suites fail with
`Unexpected token 'export'` — the repo's babel config intentionally ignores
`node_modules`, and loosening that would slow every webpack build. The plugin
was the only consumer of `d3-scale` in the monorepo, so the two scales are kept
local instead of changing shared jest/babel configuration.

If a drawer needs more d3 behavior later, prefer extending `scales.ts` over
re-introducing an ESM-only dependency into the product entry points.

## Seams left for later work packages

- **WP2 — plugin-contributed drawers (landed).** `Core-featureChartDrawer`, the
  per-`PluginManager` catalog and `drawerOptions` are documented above.
  Third-party code must not `import '@jbrowse/plugin-feature-chart'` to
  register; see `FeatureChartTrack.md` §3.5 and the website developer guide.

  **When to upgrade to a first-class `DrawerType`**
  (`pluginManager.addDrawerType`): only when a _second_ chart-like track type
  needs the same catalog / parameter schema / generated docs, or when drawers
  must be configured outside a renderer config (e.g. a track-level gallery).
  Until then the extension point is strictly cheaper: no new core surface, no
  new element type, no extra serialization.

- **WP3 — declarative `spec` (landed).** `renderer.spec` compiles to a
  `ChartModel`; painters draw models; `DrawerProps.model` is the unified input
  (WP2's `data` + `options` remain for payload-driven and plugin drawers, so
  nothing was half-migrated). The vocabulary is frozen in `SPEC.md` and grows
  additively only.
- **WP4 — renderer unification.** `renderSettings.ts` and the shared
  `computeChartX` / density-warning logic are the current duplication boundary.
- **WP5 — agent-sdk.** `listFeatureChartDrawers()` (name, displayName,
  description, dataShape, defaultSize) and `listColorSchemeNames()` are the
  intended machine-readable surface. Both are sorted deterministically.

## Tests that guard this contract

| File                                                           | Guards                                                                                                                                                                       |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `FeatureChartDrawer/drawerRegistry.test.ts`                    | catalog completeness, stable sorting, legacy registration, resolve/error paths                                                                                               |
| `FeatureChartDrawer/chartSpec.test.ts`                         | the whole 4×4 legality matrix, `data.path` grammar, the four error classes, unknown keys, style/axes bounds                                                                  |
| `FeatureChartDrawer/chartModel.test.ts`                        | stable serialization regardless of key order, hash changes for every visible field                                                                                           |
| `FeatureChartDrawer/specEquivalence.test.ts`                   | every legacy drawer == its spec preset: same model _and_ identical canvas call trace                                                                                         |
| `FeatureChartDrawer/painters.test.ts`                          | empty model draws nothing, `spec.style.colorScheme` wins over the renderer slot, `bins` changes the histogram                                                                |
| `FeatureChartDrawer/pluginDrawerRegistry.test.ts`              | extension point merge, main-thread _and_ worker assembly order, per-`PluginManager` cache + invalidation, override/warn, malformed contributions, missing-plugin diagnostics |
| `FeatureChartDrawer/samplePlugin.test.ts`                      | the shipped no-build example plugin still registers and paints, `drawerOptions` change the output                                                                            |
| `FeatureChartRenderer/configSchema.test.ts`                    | drawer default is a built-in (regression gate for the old `tissueBoxPlot` default), palette defaults                                                                         |
| `FeatureChartRenderer/renderFeatureChart.test.ts`              | config-only rendering, 6 settings from config, unknown drawer placeholder, alignment math                                                                                    |
| `renderSettings.test.ts`                                       | config → settings mapping, malformed value fallbacks                                                                                                                         |
| `FeatureChartDrawer/colorSchemes.test.ts`                      | palette shape, default, warn-once fallback, dark-mode behavior                                                                                                               |
| `FeatureChartDrawer/drawerOptions.test.ts`                     | `optionsSchema` → key set, unknown-key detection, dev warn-once wording, silence for undeclared schemas                                                                      |
| `FeatureChartDrawer/devMode.test.ts`                           | production vs development detection, including a runtime without `process` (browser bundle)                                                                                  |
| `FeatureChartDrawer/drawerData.test.ts`                        | every reachable drawer survives `undefined`/`null`/primitive/malformed payloads and still paints the payload it declares                                                     |
| `FeatureChartDrawer/demoDataContract.test.ts`                  | `test_data/feature-chart` files exist, every row carries the key its configured drawer reads, the drawer paints it, no demo track trips the unknown-key warning              |
| `LinearFeatureChartDisplay/components/MaximizeDialog.test.tsx` | Alert on unknown drawer, no alert for a valid one, maximize canvas is sized before drawing                                                                                   |
| `chartGeometry.test.ts`                                        | chart-rectangle hit test, alignment math, icon placement/clamping                                                                                                            |
| `corePluginsRegistration.test.ts`                              | all three products depend on and register the plugin                                                                                                                         |

## File map

```
src/
  FeatureChartDrawer/
    chartSpec.ts          vocabulary, legality matrix, validate/normalize, data.path
    chartModel.ts         ChartModel + stable serialization (WP4 cache key)
    painters.ts           one painter per kind + shared frame (y label lives here)
    statistics.ts         quartiles / IQR summary / KDE
    specDrawer.ts         the `spec` drawer + its placeholder
    placeholder.ts        shared canvas placeholder panel (drawer + spec errors)
    drawerRegistry.ts     module registry + per-PluginManager merge, resolve, built-ins
    drawerErrors.ts       shared placeholder/Alert wording (missing plugin, suggestions)
    drawerOptions.ts      optionsSchema key set + dev-only unknown-key warning
    devMode.ts            isDevelopmentBuild(): webpack `process.env.NODE_ENV`
    drawerData.ts         asDrawerData(): payload access that cannot throw
    colorSchemes.ts       palettes + theme resolution
    scales.ts             band/linear scales + tick values (no d3 dependency)
    types.ts              DrawerProps, DrawerFunction, drawer meta
    boxPlot.ts barPlot.ts histogramPlot.ts violinPlot.ts
  renderSettings.ts       config -> FeatureChartRenderSettings
  FeatureChartRenderer/
    configSchema.ts       drawer/chartWidth/chartHeight/align/... slots
    renderFeatureChart.ts canvas rendering, config-only reads, placeholder
  FeatureChartPlotlyRenderer/
    components/FeatureChartPlotlyRendering.tsx  Plotly rendering + palette
  chartGeometry.ts        chart rectangle, hover hit test, icon placement
  LinearFeatureChartDisplay/
    model.ts              renderProps() only adds config/theme
    components/DisplayComponent.tsx  hover state + maximize affordance placement
    components/ChartCanvas.tsx       the large chart drawn inside the dialog
    components/MaximizeDialog.tsx    Alert on unknown drawer, markdown description
```

## Hover and the maximize affordance

A chart is a **fixed-size widget** (`chartWidth` px) anchored to the feature's
start/end, so its visual width has nothing to do with how many bases the feature
covers. Two consequences, both learned the hard way in a real browser:

1. **Hit-testing must use the chart rectangle.** `FeatureChartRendering` used to
   set the hovered feature by comparing the mouse bp against
   `feature.start..feature.end`. At a zoomed-out view that is a ~5px target in
   the middle of a 120px chart, and the maximize affordance was effectively
   unreachable. `chartGeometry.findFeatureAtChartX()` now answers the question
   for both the UI and the renderer: it is the single definition of "where is
   this chart drawn" (`computeChartX`), reused by `renderFeatureChart`.
2. **Hover state lives on the display wrapper, and the icon sits inside the
   hovered chart.** The icon used to be pinned to the track's top-right corner.
   Moving the pointer from the chart to that corner left the chart, cleared
   `featureUnderMouse`, and unmounted the icon before the click landed — with
   several charts per track it was also ambiguous which chart it would open.
   `DisplayComponent` now owns the hover state (and keeps
   `model.setFeatureIdUnderMouse` in sync for the shared tooltip), and paints
   the icon at the hovered chart's top-right corner.

`ChartCanvas` is a separate component for the same category of reason: MUI
`Dialog` mounts its children in a portal _after_ the open commit, so a drawing
`useEffect` inside the dialog body runs while the canvas ref is still `null`.
The chart kept its default 300x150 backing store and the dialog looked empty.
Mounting the canvas as its own component guarantees the effect runs with the
element attached; `MaximizeDialog.test.tsx` asserts the canvas is resized.

## Demo fixture

`test_data/feature-chart/config.json` exercises all of the above in a real
browser (`pnpm --filter jbrowse-web start`, then
`/?config=test_data/feature-chart/config.json`): all five built-in drawers, the
schema default with `drawer` omitted, an unknown drawer placeholder, a
track-level `formatAbout.info`, the root `configuration.formatAbout.info`
fallback, and `formatAbout.showInfo: false`. See the README next to it.

The same config loads `plugins/sampleChartDrawers.js` through
`plugins[0].esmLoc.uri` and adds three plugin-related tracks:

| Track               | Proves                                                                                             |
| ------------------- | -------------------------------------------------------------------------------------------------- |
| `fc_plugin_heatmap` | a plugin drawer (`samplePlugin/heatmap`) paints in the RPC worker, `drawerOptions` change its form |
| `fc_plugin_dots`    | the same plugin ships a second drawer; nothing about the first one was special-cased               |
| `fc_missing_plugin` | `notLoadedPlugin/heatmap` → placeholder that names the missing plugin, track stays alive           |
| `fc_spec_box`       | `drawer: "spec"` (box / summary-stats) plus `axes.yLabel`, equivalent to `fc_precomputed`          |
| `fc_spec_bar`       | spec bar with `spec.style.colorScheme`, equivalent to `fc_bar`                                     |
| `fc_spec_hist`      | spec histogram with `style.bins: 16` — the legacy drawer only ever used 10                         |
| `fc_spec_broken`    | illegal kind×form → placeholder naming `spec.data.form` and the allowed forms, track stays alive   |
