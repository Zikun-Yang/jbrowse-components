---
id: feature_chart_migration
title: Migrating feature chart configs
---

# Migrating feature chart configs

What changed for existing `FeatureChartTrack` configs between the first
`FeatureChartRenderer` release and the current one (WP2–WP4: `drawer` catalog,
declarative specs, one model behind both backends), and what to do about each
change.

**Nothing here breaks a config that already worked.** The breaking items are
deprecated aliases that keep rendering (with one console warning) and are
planned for removal in v2; the rest are new capabilities.

## 1. `plotType` → `spec.kind`

`plotType` was the Plotly-only switch before the canvas and Plotly backends
shared one chart model. It is now a **deprecated alias** for `spec.kind`, kept
so old configs keep rendering.

```jsonc
// before
{ "type": "FeatureChartPlotlyRenderer", "plotType": "violin" }

// after
{
  "type": "FeatureChartPlotlyRenderer",
  "drawer": "spec",
  "spec": {
    "specVersion": 1,
    "kind": "violin",
    "data": { "form": "grouped-values", "path": "tissues" }
  }
}
```

### Which one wins

Read `renderer.drawer` first, then fall back — this order is the whole
compatibility story, so it is worth knowing before you debug a chart:

| `drawer` value                                 | what renders                                                                                                                                       |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `"spec"`                                       | the `spec` block, validated. Invalid spec → placeholder naming the problem.                                                                        |
| any other drawer name (`rawBoxPlot`, `p/name`) | that drawer, on both backends (Plotly draws it through its `buildModel`, or says "canvas-only" if the drawer has none).                            |
| omitted (schema default `precomputedBoxPlot`)  | the drawer **if** it can build a model for this payload; otherwise the legacy `plotType` path, plus one `console.warn` naming the equivalent spec. |

Two consequences that look like bugs but are not:

- **"My scatter chart is still there, but my box chart changed."** That is the
  order above: a named/`spec` drawer wins, and `plotType` only decides when no
  drawer was chosen _and_ no model can be built. A box chart is expressible as a
  model, so the drawer draws it; `scatter`/`line` are not in the v1 vocabulary
  (no canvas painter exists), so they keep the legacy Plotly behaviour.
- **"The same track looks different in the maximize dialog."** It should not any
  more: the dialog draws the same model the track does. If it disagrees, check
  for a `plotType` left in a config that also names a drawer — the drawer wins
  in both places now.

`plotType` warns once per page load, and `scatter`/`line` are removed in v2;
`box`, `violin`, `bar` map onto v1 kinds and should be migrated.

## 2. `drawer` default value

`renderer.drawer` used to default to `tissueBoxPlot`, a name that was never
registered — a config that omitted `drawer` rendered an "unknown drawer"
placeholder. The default is now `precomputedBoxPlot`, which is a real drawer and
reads `data.boxes`.

What to do: if you had worked around the old placeholder by always naming a
drawer, nothing changes. If you omitted `drawer` and lived with the placeholder,
you now get a box plot of `data.boxes`; name a drawer explicitly if you wanted
something else.

## 3. `registerFeatureChartDrawer` → `Core-featureChartDrawer`

`registerFeatureChartDrawer()` writes to a module-level registry. That works for
code shipped **inside** this repo, but a plugin loaded as a separate ES module
gets its own copy of that module, so its registration was invisible to the host
— the drawer simply never appeared.

Plugins must use the extension point instead:

```js
// before (worked only for in-repo code, silently did nothing from a plugin)
import { registerFeatureChartDrawer } from '@jbrowse/plugin-feature-chart'
registerFeatureChartDrawer('myPlugin/x', draw)

// after (works from any plugin, whatever module instance it gets)
export default class MyPlugin {
  name = 'MyPlugin'
  install(pluginManager) {
    pluginManager.addToExtensionPoint('Core-featureChartDrawer', drawers => [
      ...drawers,
      { name: 'myPlugin/x', draw, displayName: 'X', dataShape: 'values' },
    ])
  }
  configure() {}
}
```

`registerFeatureChartDrawer()` is still exported and still used by the
built-ins; it is **not** the plugin API. A registration from a plugin that uses
it will not be seen — the drawer catalog names the difference (`builtin: false`
for anything contributed through the extension point).

Names must be `pluginName/drawerName`. An un-namespaced plugin drawer triggers a
development warning and risks being shadowed by a built-in of the same name.

## 4. `dataShape` vocabulary

The drawer catalog and the chart spec now spell data shapes the same way. The
old names are **not** accepted; a drawer that still declares one is treated as
`any` and gets a development warning (it keeps drawing, it just stops matching
filters an agent or the UI might apply).

| old (pre-WP3) | current           |
| ------------- | ----------------- |
| `tissues`     | `grouped-values`  |
| `boxes`       | `summary-stats`   |
| `bars`        | `category-values` |
| `values`      | `values`          |

The spelling is kebab-case everywhere: config, catalog, chart spec, error
messages.

## 5. New slots (nothing to migrate, but worth knowing)

| slot            | since | what it does                                                                                                        |
| --------------- | ----- | ------------------------------------------------------------------------------------------------------------------- |
| `drawerOptions` | WP2   | arbitrary JSON handed to the drawer (`DrawerProps.options`); not validated, the drawer clamps.                      |
| `spec`          | WP3   | declarative chart, read only when `drawer: "spec"`. See the [chart spec reference](/docs/config_guides/chart_spec). |
| `renderCache`   | WP4   | reuses the painted chart between re-renders (keyed on data, size, DPR, theme, drawer options).                      |
| `colorScheme`   | WP1   | palette for the built-in drawers; the Plotly backend honours it too.                                                |

`drawerOptions` keys a drawer does not read produce a development warning (once
per key) — that is the migration signal for a typo'd option name.

## 6. Checklist

1. Replace `plotType` with `drawer: "spec"` + `spec.kind` (mapping table below).
2. Make sure every chart track names a `drawer` or has a `spec`; do not rely on
   the default unless `data.boxes` is really what you have.
3. If you ship a plugin: move to `Core-featureChartDrawer`, namespace the drawer
   names, and use the current `dataShape` spellings.
4. Run the track once and check the browser console: deprecation warnings,
   unknown `drawerOptions` keys and unknown `dataShape` names all show up there
   in development builds only.
5. `scatter`/`line`: plan for v2. They have no canvas painter, so they cannot be
   expressed as a v1 spec; the legacy Plotly path is the only thing keeping them
   alive.

`plotType` → `spec.kind` mapping:

| `plotType` | `spec.kind` | `data.form`                                                    |
| ---------- | ----------- | -------------------------------------------------------------- |
| `box`      | `box`       | `summary-stats` or `grouped-values`, whichever the payload has |
| `violin`   | `violin`    | `grouped-values`                                               |
| `bar`      | `bar`       | `category-values`                                              |
| `scatter`  | —           | not in v1 (legacy Plotly only, removed in v2)                  |
| `line`     | —           | not in v1 (legacy Plotly only, removed in v2)                  |

See also: [Feature chart drawers](./feature_chart_drawers),
[Feature chart specs](./feature_chart_specs),
[`FeatureChartTrack`](/docs/config/FeatureChartTrack).
