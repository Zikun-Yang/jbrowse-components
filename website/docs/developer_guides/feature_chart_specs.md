---
id: feature_chart_specs
title: Feature chart specs
---

# Feature chart specs

A **chart spec** describes a chart in the track config instead of in code:

```json
{
  "type": "FeatureChartRenderer",
  "drawer": "spec",
  "spec": {
    "specVersion": 1,
    "kind": "box",
    "data": { "form": "grouped-values", "path": "tissues" },
    "axes": { "yLabel": "TPM" }
  }
}
```

That is the whole idea: **no executable code in the config**, so a spec can live
in a shared session, an exported track config, or a model's output. The
vocabulary is frozen at v1 and defined normatively in
[`plugins/feature-chart/SPEC.md`](https://github.com/GMOD/jbrowse-components/blob/main/plugins/feature-chart/SPEC.md).

`spec` is read **only** when `renderer.drawer` is `"spec"`. Every other drawer
value (`rawBoxPlot`, `samplePlugin/heatmap`, …) keeps its own contract — see
[Feature chart drawers](./feature_chart_drawers).

## Vocabulary

Four `kind` values and four `data.form` values, with exactly five legal
combinations — one per pre-existing built-in drawer, so v1 draws nothing that
could not be drawn before:

| `kind`      | `data.form`       | same as              | data looks like                        |
| ----------- | ----------------- | -------------------- | -------------------------------------- |
| `box`       | `grouped-values`  | `rawBoxPlot`         | `{ "<category>": [1.2, 3.4, …] }`      |
| `box`       | `summary-stats`   | `precomputedBoxPlot` | `[{ name, min, q1, median, q3, max }]` |
| `violin`    | `grouped-values`  | `rawViolinPlot`      | `{ "<category>": [1.2, 3.4, …] }`      |
| `bar`       | `category-values` | `barPlot`            | `[{ name, value }]`                    |
| `histogram` | `values`          | `histogram`          | `[1.2, 3.4, …]` (one flat series)      |

Anything else is an **error** with the offending `path` and the `allowed` list,
never a silent downgrade. There is one spelling per term: kebab-case. The
camelCase `groupedValues` is rejected, and the message says so.

Category names always come from the data (object keys or `name`). There is no
`categories` array in the spec: two sources for one ordering drift apart
silently.

## `data.path`

A dot path to the form inside the row's `data` JSON:

| `path`                | resolves to              |
| --------------------- | ------------------------ |
| `""` / omitted        | the whole `data` object  |
| `"tissues"`           | `data.tissues`           |
| `"payload.by.tissue"` | `data.payload.by.tissue` |
| `"rows.0.values"`     | `data.rows[0].values`    |

Numeric segments index arrays. That is all: no wildcards, no JSONPath, no
expressions. A path that does not resolve reports the path together with the
keys that **were** present.

## `style` and `axes`

| field               | type   | applies to  | notes                                                      |
| ------------------- | ------ | ----------- | ---------------------------------------------------------- |
| `style.colorScheme` | string | all kinds   | `tableau10` (default), `viridis`, `set2`, `dark2`, `blues` |
| `style.bins`        | number | `histogram` | integer 1–100, default 10                                  |
| `axes.yLabel`       | string | all kinds   | rotated label on the left edge                             |

`style.colorScheme` overrides the renderer's own `colorScheme` slot. Nothing
else is configurable in v1: a chart is 120×180 px, and every other knob would
cost a decision the painter already made.

## Examples

```jsonc
// box plot from raw observations
{
  "specVersion": 1,
  "kind": "box",
  "data": { "form": "grouped-values", "path": "tissues" },
}
```

```jsonc
// precomputed box plot with a unit label
{
  "specVersion": 1,
  "kind": "box",
  "data": { "form": "summary-stats", "path": "boxes" },
  "axes": { "yLabel": "TPM (log2)" },
}
```

```jsonc
// violin, different palette
{
  "specVersion": 1,
  "kind": "violin",
  "data": { "form": "grouped-values", "path": "tissues" },
  "style": { "colorScheme": "viridis" },
}
```

```jsonc
// bar plot
{
  "specVersion": 1,
  "kind": "bar",
  "data": { "form": "category-values", "path": "bars" },
}
```

```jsonc
// histogram with 16 bins
{
  "specVersion": 1,
  "kind": "histogram",
  "data": { "form": "values", "path": "values" },
  "style": { "bins": 16 },
  "axes": { "yLabel": "genes" },
}
```

## When a spec is wrong

Specs are validated, and the diagnostics are the feature: the whole point of
declaring a chart is that a mistake is _explainable_.

- **Structural** problems (`specVersion`, unknown `kind`/`form`, an illegal
  kind×form pair, unknown keys, a bad palette or bin count) are detected once
  per render: the track draws one placeholder and the RPC result carries
  `specError`.
- **Data** problems (the path does not resolve in _this_ feature's payload) are
  per chart: that chart gets a placeholder, the rest of the track keeps
  painting.
- The **maximize dialog** lists every problem with its `path`, its message and
  the `allowed` values.
- Nothing here fails a track. In the RPC worker a throw is not caught per chart;
  it marks the whole track as errored.

```
spec.data.form: spec.kind "violin" does not accept data.form "summary-stats"
  (allowed: grouped-values)
```

## What v1 does not do

Each exclusion has a trigger, so the vocabulary grows predictably:

| Not in v1             | Why                                                                                    | When                                        |
| --------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------- |
| `scatter` / `line`    | no canvas painter: it would paint nothing in the track and show a chart in the dialog  | with a canvas painter (v1.1)                |
| `transform` (`jexl:`) | no dataset needs it yet; adds worker-side evaluation and error surface                 | first dataset the four forms cannot express |
| multi-series          | every painter is a single `scaleBand`; drawing only the first series is silently wrong | when a painter supports grouping            |
| `heatmap` / `matrix`  | no painter                                                                             | v1.2 candidate                              |
| `title`               | the track already shows the name                                                       | never                                       |
| per-item `color`      | the palette covers it                                                                  | a real request with a real config           |

A new `kind` is only added together with its canvas painter, and existing fields
never change meaning — `specVersion: 1` documents keep rendering identically.

## Renderer support

| renderer                     | `drawer: "spec"`                                       |
| ---------------------------- | ------------------------------------------------------ |
| `FeatureChartRenderer`       | supported (in the RPC worker, like every other drawer) |
| `FeatureChartPlotlyRenderer` | **not supported yet** — shows an explicit warning      |

The Plotly backend has its own data contract (`{ "<category>": number[] }` or
`{ x, y }`) and unifying the two is future work. It says so in the track rather
than rendering a blank chart.

## For agents

`SPEC.md` ships a minimal JSON Schema for this vocabulary. Tooling that runs
outside the browser (a node script that prepares or checks configs) can also use
the exported validator instead of trusting either:

```ts
import { validateChartSpec } from '@jbrowse/plugin-feature-chart'

const errors = validateChartSpec(candidate) // [] when valid
```

Every error carries `path`, `message` and, where it applies, `allowed` and
`actualKeys`, so a repair loop does not have to read this page.

A browser plugin cannot import the package — a bundled copy is a different
module instance, see [Feature chart drawers](./feature_chart_drawers). For
those, the JSON Schema and the runtime placeholder are the contract.
