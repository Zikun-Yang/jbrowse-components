# FeatureChartTrack architecture (WP0 contract)

This document is the contract other work packages build on. It covers the drawer
catalog, the failure semantics, the config boundary, and the seams left open for
WP2 (plugin-contributed drawers / `drawerOptions`), WP3 (declarative `spec`),
WP4 (renderer model unification) and WP5 (agent-sdk fields).

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

`src/FeatureChartDrawer/drawerRegistry.ts` owns a `Map<string, { meta, draw }>`.
`meta` is the serializable, enumerable part; `draw` is the function.

```ts
interface FeatureChartDrawerMeta {
  name: string
  displayName: string
  description: string // one sentence: what it draws and what it eats
  dataShape: 'tissues' | 'matrix' | 'series' | 'any'
  defaultSize?: { width: number; height: number }
  optionsSchema?: unknown // reserved for WP2 drawerOptions documentation
}
```

`dataShape` values used by the built-ins:

| dataShape | meaning                                                           |
| --------- | ----------------------------------------------------------------- |
| `tissues` | per-group arrays of raw observations (`data.tissues`)             |
| `matrix`  | per-category precomputed values/stats (`data.boxes`, `data.bars`) |
| `series`  | one numeric series (`data.values`)                                |
| `any`     | custom drawers that do not want to declare a shape                |

Public API (also re-exported from the package root):

- `registerFeatureChartDrawer(name, draw, meta?)` — the third argument is
  optional. Missing meta is filled with `displayName = name`,
  `description = 'Custom FeatureChart drawer "<name>"'`, `dataShape = 'any'`, so
  pre-catalog callers keep working.
- `getFeatureChartDrawer(name)` — unchanged signature, returns the draw function
  or `undefined`.
- `getFeatureChartDrawerMeta(name)` — catalog entry, if registered.
- `listFeatureChartDrawers()` / `listFeatureChartDrawerNames()` — sorted by
  `name` with a plain `<` comparison (no `localeCompare`), so ordering is
  identical in every worker, browser and test run.
- `resolveFeatureChartDrawer(name)` — `{ drawer, meta }` or
  `{ error, available }`; never throws.
- `initBuiltInDrawers()` — registers the five built-ins; idempotent and called
  from `FeatureChartPlugin.install()`.

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
  drawer, chartWidth, chartHeight, align,
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
config. `renderSettings.test.ts` pins the six-field mapping and the sanitizing
fallbacks.

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

- **WP2 — plugin-contributed drawers.** `registerFeatureChartDrawer`'s optional
  `meta` and `FeatureChartDrawerMeta.optionsSchema` are the intended landing
  pad. The catalog is sorted and serializable, so an extension point can expose
  `listFeatureChartDrawers()` verbatim. Until that exists, third-party code
  should not `import '@jbrowse/plugin-feature-chart'` just to register a drawer;
  see `FeatureChartTrack.md` §3.5.
- **WP3 — declarative `spec`.** Reads `config` only, so a spec can be compiled
  into the same render settings object. No display change required.
- **WP4 — renderer unification.** `renderSettings.ts` and the shared
  `computeChartX` / density-warning logic are the current duplication boundary.
- **WP5 — agent-sdk.** `listFeatureChartDrawers()` (name, displayName,
  description, dataShape, defaultSize) and `listColorSchemeNames()` are the
  intended machine-readable surface. Both are sorted deterministically.

## Tests that guard this contract

| File                                                           | Guards                                                                                               |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `FeatureChartDrawer/drawerRegistry.test.ts`                    | catalog completeness, stable sorting, legacy registration, resolve/error paths                       |
| `FeatureChartRenderer/configSchema.test.ts`                    | drawer default is a built-in (regression gate for the old `tissueBoxPlot` default), palette defaults |
| `FeatureChartRenderer/renderFeatureChart.test.ts`              | config-only rendering, 6 settings from config, unknown drawer placeholder, alignment math            |
| `renderSettings.test.ts`                                       | config → settings mapping, malformed value fallbacks                                                 |
| `FeatureChartDrawer/colorSchemes.test.ts`                      | palette shape, default, warn-once fallback, dark-mode behavior                                       |
| `LinearFeatureChartDisplay/components/MaximizeDialog.test.tsx` | Alert on unknown drawer, no alert for a valid one, maximize canvas is sized before drawing           |
| `chartGeometry.test.ts`                                        | chart-rectangle hit test, alignment math, icon placement/clamping                                    |
| `corePluginsRegistration.test.ts`                              | all three products depend on and register the plugin                                                 |

## File map

```
src/
  FeatureChartDrawer/
    drawerRegistry.ts     catalog + resolve + built-in registration
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
