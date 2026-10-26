# FeatureChartTrack architecture (WP0 contract)

This document is the contract other work packages build on. It covers the drawer
catalog, the failure semantics, the config boundary, plugin-contributed drawers
(WP2, landed), and the seams left open for WP3 (declarative `spec`), WP4
(renderer model unification) and WP5 (agent-sdk fields).

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
  dataShape: 'tissues' | 'matrix' | 'series' | 'any'
  defaultSize?: { width: number; height: number }
  optionsSchema?: unknown // documentation for drawerOptions keys (not validated)
}
```

`dataShape` values used by the built-ins:

| dataShape | meaning                                                           |
| --------- | ----------------------------------------------------------------- |
| `tissues` | per-group arrays of raw observations (`data.tissues`)             |
| `matrix`  | per-category precomputed values/stats (`data.boxes`, `data.bars`) |
| `series`  | one numeric series (`data.values`)                                |
| `any`     | custom drawers that do not want to declare a shape                |

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

- **WP3 — declarative `spec`.** Reads `config` only, so a spec can be compiled
  into the same render settings object. No display change required. The drawer
  signature is the seam: WP2 keeps `data` and adds `options`; WP3 replaces
  `data` with the normalized chart model _in the same commit series_, never in
  parallel, so there is no half-migrated state.
- **WP4 — renderer unification.** `renderSettings.ts` and the shared
  `computeChartX` / density-warning logic are the current duplication boundary.
- **WP5 — agent-sdk.** `listFeatureChartDrawers()` (name, displayName,
  description, dataShape, defaultSize) and `listColorSchemeNames()` are the
  intended machine-readable surface. Both are sorted deterministically.

## Tests that guard this contract

| File                                                           | Guards                                                                                                                                                                       |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `FeatureChartDrawer/drawerRegistry.test.ts`                    | catalog completeness, stable sorting, legacy registration, resolve/error paths                                                                                               |
| `FeatureChartDrawer/pluginDrawerRegistry.test.ts`              | extension point merge, main-thread _and_ worker assembly order, per-`PluginManager` cache + invalidation, override/warn, malformed contributions, missing-plugin diagnostics |
| `FeatureChartDrawer/samplePlugin.test.ts`                      | the shipped no-build example plugin still registers and paints, `drawerOptions` change the output                                                                            |
| `FeatureChartRenderer/configSchema.test.ts`                    | drawer default is a built-in (regression gate for the old `tissueBoxPlot` default), palette defaults                                                                         |
| `FeatureChartRenderer/renderFeatureChart.test.ts`              | config-only rendering, 6 settings from config, unknown drawer placeholder, alignment math                                                                                    |
| `renderSettings.test.ts`                                       | config → settings mapping, malformed value fallbacks                                                                                                                         |
| `FeatureChartDrawer/colorSchemes.test.ts`                      | palette shape, default, warn-once fallback, dark-mode behavior                                                                                                               |
| `LinearFeatureChartDisplay/components/MaximizeDialog.test.tsx` | Alert on unknown drawer, no alert for a valid one, maximize canvas is sized before drawing                                                                                   |
| `chartGeometry.test.ts`                                        | chart-rectangle hit test, alignment math, icon placement/clamping                                                                                                            |
| `corePluginsRegistration.test.ts`                              | all three products depend on and register the plugin                                                                                                                         |

## File map

```
src/
  FeatureChartDrawer/
    drawerRegistry.ts     module registry + per-PluginManager merge, resolve, built-ins
    drawerErrors.ts       shared placeholder/Alert wording (missing plugin, suggestions)
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
