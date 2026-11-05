---
id: chart_spec
title: Chart spec reference
---

# Chart spec reference

A **chart spec** describes a `FeatureChartTrack` chart in the config instead of
naming a drawer:

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

No code in the config, so a spec can travel in a shared session or be written by
a script or a model. This page is the table-ized reference; the normative
contract with rationale is `plugins/feature-chart/SPEC.md` in the repository,
and the narrative introduction is
[Feature chart specs](/docs/developer_guides/feature_chart_specs/).

`spec` is read **only** when `renderer.drawer` is exactly `"spec"`.

## Fields

| path          | type    | required | values / notes                                                                                  |
| ------------- | ------- | -------- | ----------------------------------------------------------------------------------------------- |
| `specVersion` | integer | yes      | `1`. A larger number is rejected with "newer than this build supports", never guessed at.       |
| `kind`        | string  | yes      | `box`, `violin`, `bar`, `histogram`                                                             |
| `data`        | object  | yes      | see below                                                                                       |
| `data.form`   | string  | yes      | `summary-stats`, `grouped-values`, `category-values`, `values` — restricted by `kind`           |
| `data.path`   | string  | no       | dotted path into the row's `data` JSON; omit or `""` for the payload root                       |
| `axes`        | object  | no       | only `yLabel` (string, rotated label on the left edge)                                          |
| `style`       | object  | no       | `colorScheme` (palette name) and `bins` (integer 1–100, `histogram` only)                       |
| anything else | —       | —        | rejected: `additionalProperties: false`, the error names the offending key and the allowed ones |

## `kind` × `data.form`

Five legal combinations — one per built-in drawer, so a spec cannot draw
anything the drawers could not:

| `kind`      | allowed `data.form` | equivalent drawer    | what it draws                                |
| ----------- | ------------------- | -------------------- | -------------------------------------------- |
| `box`       | `grouped-values`    | `rawBoxPlot`         | box + 1.5×IQR whiskers from raw observations |
| `box`       | `summary-stats`     | `precomputedBoxPlot` | box from precomputed five-number summaries   |
| `violin`    | `grouped-values`    | `rawViolinPlot`      | kernel density violin from raw observations  |
| `bar`       | `category-values`   | `barPlot`            | one bar per category                         |
| `histogram` | `values`            | `histogram`          | binned frequency of one numeric series       |

Any other pair is an error naming `spec.data.form` and the forms that `kind`
does accept — never a silent downgrade.

## `data.form` payloads

| form              | shape                                         | example                                                                                      |
| ----------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `grouped-values`  | object: category name → array of observations | `{ "tissues": { "Brain": [35.1, 36.3], "Liver": [6.5] } }`                                   |
| `summary-stats`   | array of `{ name, min, q1, median, q3, max }` | `{ "boxes": [{ "name": "Brain", "min": 40, "q1": 41, "median": 50, "q3": 53, "max": 55 }] }` |
| `category-values` | array of `{ name, value }`                    | `{ "bars": [{ "name": "Brain", "value": 42 }] }`                                             |
| `values`          | one flat array of numbers, no categories      | `{ "values": [0.1, 1.38, 1.96] }`                                                            |

Category order always comes from the data (object key order, or the order of the
array). There is no `categories` list in the spec on purpose. Non-finite numbers
are dropped, entries without a usable `name` are skipped, and empty input draws
an empty chart instead of throwing.

## `data.path`

| `path`                | resolves to              |
| --------------------- | ------------------------ |
| omitted or `""`       | the `data` object itself |
| `"tissues"`           | `data.tissues`           |
| `"payload.by.tissue"` | `data.payload.by.tissue` |
| `"rows.0.values"`     | `data.rows[0].values`    |

Plain dot notation only: no wildcards, no expressions, no JSONPath. A path that
does not resolve reports the path it tried and the keys that were available in
that particular row.

## `style` and `axes`

| key                 | type    | default     | notes                                                   |
| ------------------- | ------- | ----------- | ------------------------------------------------------- |
| `style.colorScheme` | string  | `tableau10` | one of `blues`, `dark2`, `set2`, `tableau10`, `viridis` |
| `style.bins`        | integer | `10`        | 1–100, `histogram` only; other kinds reject it          |
| `axes.yLabel`       | string  | none        | the only axis decoration v1 has                         |

## Complete examples

Box plot from precomputed statistics (same picture as `precomputedBoxPlot`):

```json
{
  "drawer": "spec",
  "spec": {
    "specVersion": 1,
    "kind": "box",
    "data": { "form": "summary-stats", "path": "boxes" }
  }
}
```

Violin from raw observations, with a label:

```json
{
  "drawer": "spec",
  "spec": {
    "specVersion": 1,
    "kind": "violin",
    "data": { "form": "grouped-values", "path": "tissues" },
    "axes": { "yLabel": "expression (TPM)" }
  }
}
```

Bar chart with a palette:

```json
{
  "drawer": "spec",
  "spec": {
    "specVersion": 1,
    "kind": "bar",
    "data": { "form": "category-values", "path": "bars" },
    "style": { "colorScheme": "set2" }
  }
}
```

Histogram with 16 bins:

```json
{
  "drawer": "spec",
  "spec": {
    "specVersion": 1,
    "kind": "histogram",
    "data": { "form": "values", "path": "values" },
    "style": { "bins": 16 }
  }
}
```

## What a bad spec does

Never a broken track. The chart area shows a placeholder naming the problem, and
the maximize dialog lists every problem:

| mistake                            | message                                                                                      |
| ---------------------------------- | -------------------------------------------------------------------------------------------- |
| wrong `kind`                       | `"bxo" is not a chart kind` / `allowed: box, violin, bar, histogram`                         |
| `kind` × `form` mismatch           | `spec.kind "violin" does not accept data.form "summary-stats"` / `allowed: grouped-values`   |
| typo'd key                         | `unknown key "colours"; allowed: colorScheme, bins`                                          |
| `path` resolves to the wrong shape | `spec.data.path "boxes" is not a valid input for that form (summary-stats expects an array)` |
| `bins` on a non-histogram          | `style.bins only applies to kind "histogram"; kind is "box"`                                 |
| older/newer `specVersion`          | `specVersion 2 is newer than this build supports (1)`                                        |

## For agents and tooling

The same vocabulary is published at runtime, derived from the constants the
validator enforces:

| surface                     | what it returns                                                                                      |
| --------------------------- | ---------------------------------------------------------------------------------------------------- |
| `jbrowse.chartSpecSchema()` | this page as data: `kinds`, `dataForms`, `kindDataForms`, `bins`, `colorSchemes`, plus a JSON Schema |
| `jbrowse.chartDrawers()`    | the drawer catalog (`name`, `displayName`, `description`, `dataShape`, `builtin`)                    |
| `jbrowse.chartDrawer(name)` | one catalog row, or `UNKNOWN_DRAWER` with the available names                                        |

See `products/jbrowse-agent/README.md` in the repository for the script-level
usage, and
[Feature chart drawers](/docs/developer_guides/feature_chart_drawers/) for
writing a drawer instead of a spec.

Coming from a pre-WP4 config with `plotType`? See
[Migrating to chart specs](/docs/developer_guides/feature_chart_migration/).
