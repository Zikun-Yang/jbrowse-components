---
id: feature_chart_drawers
title: Feature chart drawers
---

# Feature chart drawers

`FeatureChartTrack` draws one small chart per feature (canvas 2D), plus a larger
version in the maximize dialog. **A "drawer" is the function that paints one
chart.** This page is the contract for writing your own and shipping it as a
plugin, without forking JBrowse.

Read [`FeatureChartTrack`](../config/FeatureChartTrack) for the TSV data format,
the built-in drawer list and config examples, and
`plugins/feature-chart/ARCHITECTURE.md` in the repository for the internal
design.

## Three ways to change what a chart looks like

| You want                                     | Do this                                   | Needs a plugin? |
| -------------------------------------------- | ----------------------------------------- | --------------- |
| Pick a different existing chart              | `renderer.drawer: "rawViolinPlot"`        | no              |
| Change colors / sizes / a drawer's own knobs | `renderer.drawerOptions: { … }`           | no              |
| Describe a chart in the config itself        | `renderer.drawer: "spec"` + `spec: { … }` | no              |
| Add a chart that does not exist yet          | contribute a drawer from a plugin         | yes             |

The `spec` row is the declarative one —
`{"kind": "box", "data": {"form": "grouped-values", "path": "tissues"}}` instead
of a drawer name. It covers what the five built-in drawers cover, with no code
in the config; see [Feature chart specs](./feature_chart_specs).

This page is the last row.

## The drawer contract

A drawer is a function that receives a canvas context and paints into
`width × height`:

```ts
interface DrawerProps {
  ctx: CanvasRenderingContext2D
  width: number
  height: number
  /** `data` column of the TSV row, already JSON-parsed. */
  data: unknown
  /** `description` column (markdown template, may contain `{{name}}`). */
  description?: string
  name: string
  region: { refName: string; start: number; end: number; assemblyName: string }
  bpPerPx: number
  feature: Feature
  config: AnyConfigurationModel
  theme: ThemeOptions
  /** Resolved `colorScheme` palette for the active (light/dark) theme. */
  colorScheme?: FeatureChartColorScheme
  /** `renderer.drawerOptions`, verbatim. Always an object; may be empty. */
  options?: Record<string, unknown>
  /**
   * Normalized chart model, set when the configured drawer is `spec` (see
   * "Feature chart specs"). Optional: a payload-driven drawer reads `data`.
   */
  model?: ChartModel
  /** Why `model` is absent (`drawer: "spec"` only). */
  modelErrors?: ChartSpecError[]
  /** True inside the maximize dialog (more room for axes/labels). */
  isMaximize?: boolean
}
```

Rules that matter in practice:

- **Paint only.** No DOM, no `document`, no network. The canvas drawer also runs
  inside the RPC worker, where none of those exist.
- **Fixed size.** A chart is `chartWidth × chartHeight` px, anchored to the
  feature's start/end. Do not try to scale with `bpPerPx`.
- **Never throw for bad data.** Throw inside a worker and the whole track turns
  into an error. Return early when the data shape is not what you expect.
- **`data` is not guaranteed to be an object.** It is "whatever the `data`
  column contained, JSON parsed", so it can be `null`, a number, a string — or
  `undefined` when the feature carries no payload at all. Read it defensively;
  the built-ins all go through an `asDrawerData()` helper that answers `{}` for
  anything that is not a plain object:

  ```js
  const payload = data && typeof data === 'object' ? data : {}
  const rows = Array.isArray(payload.boxes) ? payload.boxes : []
  if (rows.length === 0) {
    return // nothing to draw: an empty chart, not a broken track
  }
  ```

  The same rule applies one level down: a group can be `null`, a value can be a
  string or `NaN`. Filter to finite numbers before computing a scale.

- **Respect `isMaximize`** if the small and large versions should differ (axis
  labels, tick counts).
- Colors are `colorScheme.colors` (already theme-adjusted) or plain `#rrggbb`
  strings; the built-ins append a hex alpha suffix (`color + '33'`), which only
  works for hex.

## Contributing a drawer from a plugin

Register through the **`Core-featureChartDrawer` extension point**. The
extension point receives the currently registered drawers and returns the new
full list, so append with a spread:

```js
// myChartDrawers.js — a no-build, single-file ES module
export default class MyChartDrawers {
  name = 'MyChartDrawers'

  install(pluginManager) {
    pluginManager.addToExtensionPoint('Core-featureChartDrawer', drawers => [
      ...drawers,
      {
        name: 'myPlugin/heatmap',
        displayName: 'Heatmap',
        description: 'One cell per observation, colored by value.',
        dataShape: 'grouped-values',
        optionsSchema: { colorRamp: 'cool | warm', cellGap: 'px, 0-6' },
        draw: ({ ctx, width, height, data, options }) => {
          const ramp = options?.colorRamp ?? 'cool'
          // … paint with ctx …
        },
      },
    ])
  }

  configure() {}
}
```

Then load the file from the config and reference the drawer by name:

```json
{
  "plugins": [{ "esmLoc": { "uri": "plugins/myChartDrawers.js" } }],
  "tracks": [
    {
      "type": "FeatureChartTrack",
      "trackId": "my_track",
      "adapter": { "type": "FeatureChartTabixAdapter", "uri": "data.tsv.gz" },
      "displays": [
        {
          "type": "LinearFeatureChartDisplay",
          "renderer": {
            "type": "FeatureChartRenderer",
            "drawer": "myPlugin/heatmap",
            "drawerOptions": { "colorRamp": "warm", "cellGap": 2 }
          }
        }
      ]
    }
  ]
}
```

A working example ships in the repository:
`test_data/feature-chart/plugins/sampleChartDrawers.js` (two drawers, no
imports, no build step) plus the tracks it powers in
`test_data/feature-chart/config.json`.

### Naming: prefix with your plugin name

Use `pluginName/drawerName`. Drawers are looked up in one flat catalog, so a
bare name like `heatmap` will eventually collide with someone else's `heatmap`.

The built-in names (`precomputedBoxPlot`, `rawBoxPlot`, `rawViolinPlot`,
`barPlot`, `histogram`, `spec`) are **not reserved**: a plugin may override
them. The last registration wins and a development build logs a warning, because
overriding a built-in silently changes what existing configs render.

### `dataShape` vocabulary

The catalog uses the same words as the chart-spec forms — one spelling per
shape, in the config and in the catalog:

| `dataShape`       | payload                                |
| ----------------- | -------------------------------------- |
| `grouped-values`  | `{ "<category>": number[] }`           |
| `summary-stats`   | `[{ name, min, q1, median, q3, max }]` |
| `category-values` | `[{ name, value }]`                    |
| `values`          | `number[]` (one flat series)           |
| `any`             | anything else / not declared           |

The pre-WP3 names (`tissues`, `matrix`, `series`) are no longer accepted: a
drawer that still declares one is treated as `any` and a development build says
so, so the catalog cannot drift into two vocabularies.

### Do not import the package to register

```js
// WRONG — looks fine, does nothing
import { registerFeatureChartDrawer } from '@jbrowse/plugin-feature-chart'
registerFeatureChartDrawer('myPlugin/x', draw)
```

A plugin loaded with `esmLoc`/`esmUrl` is a separate ES module graph: there is
no import map, so a bare package name does not resolve, and if you bundle it the
plugin carries its **own copy** of the registry module. The registration lands
in that copy, the host never sees it, and nothing errors. Always use the
extension point.

`registerFeatureChartDrawer()` / `getFeatureChartDrawer(name)` still exist as a
**legacy** API for code inside this repository (built-ins, unit tests) — it only
ever sees registrations made through the same module instance.

### How lookup works

Drawers are resolved per `PluginManager`, so plugin contributions are visible
wherever the plugin is installed — including the RPC worker that paints the
in-track charts:

```ts
import {
  listFeatureChartDrawers,
  resolveFeatureChartDrawer,
} from '@jbrowse/plugin-feature-chart'

const catalog = listFeatureChartDrawers(pluginManager) // built-ins + plugins
const resolution = resolveFeatureChartDrawer('myPlugin/heatmap', pluginManager)
// { drawer, meta } | { error, available, missingPlugin?, suggestions? }
```

- The merged catalog is cached per plugin manager (`WeakMap`).
  `clearFeatureChartDrawerCache(pluginManager)` forces a rebuild — needed after
  hot reloading a plugin, or in tests that add an extension point callback after
  configuration.
- `resolveFeatureChartDrawer` never throws: an unknown name returns
  `{ error, available, missingPlugin?, pluginLoaded?, suggestions? }` and the
  renderer paints a placeholder. That is deliberate — a worker-level throw marks
  the whole track as failed.

### Main thread vs worker

`FeatureChartPlugin` is part of every product's `corePlugins`, and the RPC
worker installs the same runtime plugins from the config. Consequences:

- Registering in `install()` is enough; nothing needs to be serialized across
  the boundary (the catalog is rebuilt inside the worker).
- The file is fetched twice (once per context). Bump the URL (`?v=2`) or rely on
  `__jbrowseCacheBuster` when iterating, otherwise one context may keep a stale
  copy.
- To confirm your plugin really installed in both contexts, set a global in
  `install()` and read it from the page console and from the worker:

  ```js
  globalThis.__myPlugin = {
    context: typeof window === 'undefined' ? 'worker' : 'main thread',
  }
  ```

  `test_data/feature-chart/plugins/sampleChartDrawers.js` does exactly this.

## `drawerOptions`: one drawer, several forms

`drawerOptions` is a `frozen` config slot (any JSON object) passed to the drawer
as `DrawerProps.options`. One registered drawer can therefore cover a family of
looks:

```json
{
  "drawer": "myPlugin/heatmap",
  "drawerOptions": { "colorRamp": "warm", "cellGap": 2 }
}
```

- **Not validated.** The config editor does not check it, and a bad value shows
  up as a wrong-looking chart rather than an error. Always default and clamp
  inside the drawer:

  ```js
  const gap = clamp(
    typeof options?.cellGap === 'number' ? options.cellGap : 1,
    0,
    6,
  )
  ```

- **Unknown keys warn once in development.** Declare the keys you read in the
  catalog and a development build logs one `console.warn` per drawer and key set
  when a config passes a key you never look at — the "my option does nothing"
  case is the one thing a value check cannot find for you:

  ```js
  {
    name: 'myPlugin/heatmap',
    optionsSchema: { colorRamp: 'cool | warm | mono', cellGap: 'px, 0-6' },
    // …
  }
  ```

  ```
  [feature-chart] drawer "myPlugin/heatmap" ignores unknown drawerOptions "colourRamp";
  it reads: colorRamp, cellGap
  ```

  `optionsSchema` takes an object (`{ key: 'human readable description' }`) or a
  plain array of keys. Its semantics are:

  | `optionsSchema`                 | Meaning                                       | Unknown key  |
  | ------------------------------- | --------------------------------------------- | ------------ |
  | `{ colorRamp: 'cool \| warm' }` | these keys are read                           | warns        |
  | `{}` / `[]`                     | reads no options (the built-ins declare `{}`) | warns        |
  | omitted / `null`                | undeclared — cannot be checked                | stays silent |

  It is still **documentation, not validation**: nothing is rejected, coerced or
  defaulted, and production builds never warn. A plugin that omits
  `optionsSchema` therefore keeps its options working exactly as before, it just
  gives up the typo warning.

- The same warning fires from the in-track canvas (the RPC worker's console) and
  from the maximize dialog, so a typo is visible without opening devtools on the
  worker specifically.

- `FeatureChartPlotlyRenderer` accepts the slot too (so switching renderers does
  not lose configuration) but the Plotly backend does not consume drawers yet.

## Failure behaviour (what users see)

| Situation                                                | Result                                                                                                                                                         |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| drawer name is not registered, plugin not loaded         | placeholder says the name is unknown, that drawers named `plugin/drawer` come from a plugin, which one to add to `config.plugins`, and lists available drawers |
| drawer name not registered, but the plugin **is** loaded | placeholder says the plugin is loaded but provides no such drawer, and suggests close matches                                                                  |
| the drawer function returns without painting             | empty chart area (your drawer decided there was nothing to draw) — log in dev if that is unexpected                                                            |
| the drawer throws                                        | the track reports an error; this is the one failure mode you must avoid                                                                                        |

The same message appears in the maximize dialog as an `Alert`, so a broken
`drawer` never renders a silently empty dialog.

## When to use something else

- **Only the appearance changes, not the mark** → `drawerOptions`.
- **A whole new kind of view with its own interaction (React, Plotly, …)** →
  register a renderer/display instead (`addRendererType` / `addDisplayType`).
  That path is heavier: you reimplement positioning, hover and the maximize
  affordance, so prefer a drawer unless you really need interactivity.
- **A chart the built-ins cannot express but the spec vocabulary can** →
  `renderer.drawer: "spec"` plus a `spec` block; no code, no plugin. See
  [Feature chart specs](./feature_chart_specs).
- **A chart kind the built-ins cannot express and you want it in every track** →
  a drawer is still the right unit; a first-class `DrawerType`
  (`pluginManager.addDrawerType`) is deliberately not implemented yet. It
  becomes worth doing when a second chart-like track type needs the same
  catalog, parameter schema and docs.
