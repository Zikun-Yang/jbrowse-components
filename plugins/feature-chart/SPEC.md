# Chart spec v1 (frozen vocabulary)

`spec` is a **declarative chart description**: JSON in the track config, no code.
A config says *what* to draw; the painters live in this plugin. This is the
supported way to get a chart that the five built-in drawers do not cover,
without forking JBrowse and without a plugin.

```json
{
  "type": "FeatureChartRenderer",
  "drawer": "spec",
  "spec": {
    "specVersion": 1,
    "kind": "box",
    "data": { "form": "grouped-values", "path": "tissues" },
    "axes": { "yLabel": "TPM" },
    "style": { "colorScheme": "tableau10", "bins": 10 }
  }
}
```

`spec` is read **only** when `drawer` is exactly `"spec"`. Every other `drawer`
value keeps its own data contract (see [`ARCHITECTURE.md`](./ARCHITECTURE.md)).

**v1 is frozen.** Everything below is a compatibility promise: fields may be
added, meanings never change. Read §9 before proposing an extension.

## 1. Vocabulary (v1)

Four `kind` values, four `data.form` values, five legal combinations — one per
existing built-in drawer, so **v1 draws nothing that could not be drawn before**:

| `kind`      | allowed `data.form` | equivalent legacy drawer | what it draws                                    |
| ----------- | ------------------- | ------------------------ | ------------------------------------------------ |
| `box`       | `grouped-values`    | `rawBoxPlot`             | box + 1.5×IQR whiskers from raw observations      |
| `box`       | `summary-stats`     | `precomputedBoxPlot`     | box from precomputed five-number summaries        |
| `violin`    | `grouped-values`    | `rawViolinPlot`          | kernel density violin from raw observations       |
| `bar`       | `category-values`   | `barPlot`                | one bar per category, one number each             |
| `histogram` | `values`            | `histogram`              | binned frequency of one flat numeric series       |

Any other combination is an **error**, not a silent downgrade. The validator
answers with the exact `path`, the `allowed` list and the keys that were actually
present (§7).

There is exactly one spelling per term: **kebab-case**, in configs, in the
drawer catalog (`dataShape`) and in error messages. `groupedValues` is not
accepted — an agent (or a person) that writes it gets

```
spec.kind "box" does not accept data.form "groupedValues"
  allowed: grouped-values, summary-stats
  actualKeys: form, path
```

## 2. `data.form`

The form is the shape of the data itself; there is no selector language.

**`grouped-values`** — object mapping category → raw observations:

```json
{ "tissues": { "Brain": [35.06, 36.33, 43.78], "Liver": [6.46, 9.76, 15.41] } }
```

**`summary-stats`** — array of five-number summaries (`name` + `min`/`q1`/`median`/`q3`/`max`):

```json
{ "boxes": [{ "name": "Brain", "min": 40.13, "q1": 41.49, "median": 49.99, "q3": 53.38, "max": 54.58 }] }
```

**`category-values`** — array of `{ name, value }`:

```json
{ "bars": [{ "name": "Brain", "value": 42 }, { "name": "Liver", "value": 18 }] }
```

**`values`** — one flat array of numbers (no categories):

```json
{ "values": [0.1, 1.38, 1.96, 3.53, 4.02] }
```

Category names always come from the data (object keys or the `name` field).
There is deliberately **no `categories` array** in the spec: two sources for the
same ordering drift apart, and the drift is invisible.

Numbers that are not finite (`null`, `"7"`, `NaN`) are dropped from a group, and
an entry without a usable `name` is skipped. Empty input draws an empty chart —
never an exception (§7).

## 3. `data.path`

Dot notation pointing at the form inside the row's `data` JSON:

| `path`             | resolves to                                    |
| ------------------ | ---------------------------------------------- |
| `""` or omitted    | the `data` object itself (root)                |
| `"tissues"`        | `data.tissues`                                 |
| `"payload.by.tissue"` | `data.payload.by.tissue`                    |
| `"rows.0.values"`  | `data.rows[0].values` (numeric = array index)  |

That is the whole grammar. No wildcards, no expressions, no JSONPath
(`$..values` is an error, and it says so). A path that does not resolve reports
the path it tried and the keys that **were** available (§7) — that one detail is
what makes "shape mismatch" debuggable without reading source code.

## 4. `style`

| field         | type   | applies to         | notes                                                          |
| ------------- | ------ | ------------------ | -------------------------------------------------------------- |
| `colorScheme` | string | all kinds          | `tableau10` (default), `viridis`, `set2`, `dark2`, `blues`      |
| `bins`        | number | `histogram` only    | integer 1–100, default 10                                       |

`style.colorScheme` wins over the renderer's `colorScheme` slot; when it is
absent the renderer slot applies. Unknown palette names fall back to
`tableau10` and warn once (the same rule as the renderer slot).

Deliberately absent in v1: per-item `color` (the palette covers it; the legacy
`precomputedBoxPlot`/`barPlot` data may still carry `color` per entry),
`showOutliers` (the 1.5×IQR clamp is fixed behaviour, and a switch that does not
change anything is a dead config — WP0 had to remove one of those).

## 5. `axes`

| field    | type   | notes                                                       |
| -------- | ------ | ----------------------------------------------------------- |
| `yLabel` | string | rotated label on the left edge; ~14px extra left margin      |

`yLabel` is the only thing v1 adds to what the old painters could draw. With no
`yLabel`, a spec chart is pixel-identical to its legacy equivalent; with one,
the only differences are the left margin and the label text.

Axis ranges, tick counts, grid, fonts and paddings are not configurable in v1 —
a chart is 120×180 px, and every knob there costs a decision the painter already
made once.

## 6. `specVersion`

Required, integer, currently `1`. A version **greater** than the one this build
supports is an error whose message says the config needs a newer build — not a
best-effort render of a vocabulary we do not know:

```
spec.specVersion 2 is newer than this build supports (1).
Update BioSeek / JBrowse to render this chart.
```

## 7. Six examples you can paste

1. Box plot from raw observations, one group per tissue:

```json
{ "specVersion": 1, "kind": "box", "data": { "form": "grouped-values", "path": "tissues" } }
```

2. Box plot from precomputed statistics, with a unit label:

```json
{
  "specVersion": 1,
  "kind": "box",
  "data": { "form": "summary-stats", "path": "boxes" },
  "axes": { "yLabel": "TPM (log2)" }
}
```

3. Violin plot from the same raw observations, different palette:

```json
{
  "specVersion": 1,
  "kind": "violin",
  "data": { "form": "grouped-values", "path": "tissues" },
  "style": { "colorScheme": "viridis" }
}
```

4. Bar plot of one number per category:

```json
{ "specVersion": 1, "kind": "bar", "data": { "form": "category-values", "path": "bars" } }
```

5. Histogram of one flat series, 16 bins:

```json
{
  "specVersion": 1,
  "kind": "histogram",
  "data": { "form": "values", "path": "values" },
  "style": { "bins": 16 },
  "axes": { "yLabel": "genes" }
}
```

6. A **wrong** spec, and what it reports (this is an acceptance test):

```json
{ "specVersion": 1, "kind": "violin", "data": { "form": "summary-stats", "path": "boxes" } }
```

```
Invalid chart spec: spec.kind "violin" does not accept data.form "summary-stats"
  allowed: grouped-values
  spec.data.path "boxes" is not a valid input for that form (summary-stats expects an array)
```

## 8. Error semantics

- The validator never throws. `normalizeFromSpec(spec, data)` answers
  `{ model }` or `{ errors }`, and each error is

  ```ts
  interface ChartSpecError {
    path: string // "spec.data.form" — always points into the config
    message: string
    allowed?: string[] // valid values at that path
    actualKeys?: string[] // keys actually present in the data
  }
  ```

- **Structural** errors (`specVersion`, unknown `kind`/`form`, illegal
  combination) are detected once per render: the canvas draws a placeholder
  across the render width and the RPC result carries `specError`, exactly like
  the unknown-drawer case in WP0/WP2.
- **Data** errors (the path does not resolve in *this* feature's payload) are
  per chart: that chart gets a small placeholder with the first error; other
  charts on the track keep painting.
- The maximize dialog lists **all** errors in an MUI `Alert`, not just the first.
- Nothing here fails a track. In the RPC worker a throw is not caught per chart;
  it marks the whole track as errored.

## 9. Evolution rules (v1 → later)

1. **Additive only.** New optional fields, new `kind` values, new `form` values.
   An existing field never changes meaning, and a `specVersion: 1` document keeps
   parsing and rendering identically in every later build.
2. **A new `kind` needs a canvas painter in the same change.** The rule that
   produced v1 stays in force: a kind that only Plotly can draw would paint
   nothing in the track and show a chart in the dialog — exactly the
   inconsistency WP4 exists to remove.
3. **`transform` (data expressions) is not added until a real dataset cannot be
   expressed with the four forms.** TSV producers already write one of the four
   shapes (`precomputedBoxPlot` exists precisely because someone did); adding a
   worker-side expression evaluator buys nothing today and costs an error surface.
4. **Multi-series** arrives as an optional array field (`series[]`) with the
   single-series document meaning "one series". The internal `ChartModel` already
   keeps a length-1 `series` array for this reason, so consumers do not break.
5. **Nothing is removed.** A field that turns out to be a bad idea is deprecated
   in the docs, kept parsing, and stops being rendered only when a major version
   bump lands with a migration note.

Trigger table (unchanged from the WP3 decision):

| Excluded                 | Why                                                                                       | When                                                       |
| ------------------------ | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `scatter` / `line`       | no canvas painter today; Plotly-only kinds paint nothing in the track                     | with a canvas painter (v1.1)                               |
| `transform` / `jexl:`    | no dataset needs it; adds worker-side evaluation and error surface                        | first dataset the four forms cannot express                |
| multi-series / `series[]`| every painter is a single `scaleBand`; drawing only the first series is silently wrong     | when a painter supports grouping (additive field)          |
| `heatmap` / `matrix`     | no painter                                                                                | v1.2 candidate                                             |
| `title`                  | the track already shows the name; a title in a 120px chart is noise                        | never                                                      |
| per-item `color`         | the palette covers it; legacy drawers still honour `color` in their own data               | a real request with a real config                          |

## 10. Renderer support

| renderer                    | `drawer: "spec"`                                                        |
| --------------------------- | ----------------------------------------------------------------------- |
| `FeatureChartRenderer`      | supported — in the RPC worker, like every other drawer                   |
| `FeatureChartPlotlyRenderer`| **not supported yet.** Renders an explicit warning; it does not fake it. |

The Plotly backend has its **own** data contract (it reads
`{ "<category>": number[] | number }` or `{ x, y }` straight off `data` and has
no notion of `tissues`/`boxes`/`bars`/`values`). Unifying the two backends is
WP4; until then the two contracts are documented separately and neither pretends
to understand the other.

## 11. Minimal JSON Schema (for agents)

Hand this to a model that writes configs; it rejects every mistake the validator
reports, before the config is ever loaded.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "FeatureChart chart spec v1",
  "type": "object",
  "required": ["specVersion", "kind", "data"],
  "additionalProperties": false,
  "properties": {
    "specVersion": { "const": 1 },
    "kind": { "enum": ["box", "violin", "bar", "histogram"] },
    "data": {
      "type": "object",
      "required": ["form"],
      "additionalProperties": false,
      "properties": {
        "form": {
          "enum": ["grouped-values", "summary-stats", "category-values", "values"]
        },
        "path": { "type": "string", "pattern": "^$|^[^.[\\]]+(\\.[^.[\\]]+)*$" }
      }
    },
    "axes": {
      "type": "object",
      "additionalProperties": false,
      "properties": { "yLabel": { "type": "string", "maxLength": 64 } }
    },
    "style": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "colorScheme": {
          "enum": ["tableau10", "viridis", "set2", "dark2", "blues"]
        },
        "bins": { "type": "integer", "minimum": 1, "maximum": 100 }
      }
    }
  },
  "allOf": [
    {
      "if": { "properties": { "kind": { "const": "box" } } },
      "then": {
        "properties": {
          "data": { "properties": { "form": { "enum": ["grouped-values", "summary-stats"] } } }
        }
      }
    },
    {
      "if": { "properties": { "kind": { "const": "violin" } } },
      "then": {
        "properties": {
          "data": { "properties": { "form": { "const": "grouped-values" } } }
        }
      }
    },
    {
      "if": { "properties": { "kind": { "const": "bar" } } },
      "then": {
        "properties": {
          "data": { "properties": { "form": { "const": "category-values" } } }
        }
      }
    },
    {
      "if": { "properties": { "kind": { "const": "histogram" } } },
      "then": {
        "properties": {
          "data": { "properties": { "form": { "const": "values" } } }
        }
      }
    }
  ]
}
```

## 12. Where this is implemented

| concern                                   | file                                                     |
| ----------------------------------------- | -------------------------------------------------------- |
| vocabulary, legality matrix, validator    | `src/FeatureChartDrawer/chartSpec.ts`                    |
| normalized model, stable hash             | `src/FeatureChartDrawer/chartModel.ts`                   |
| painters (one per `kind`)                 | `src/FeatureChartDrawer/painters.ts`                     |
| legacy drawers → model adapters           | `src/FeatureChartDrawer/legacyDrawers.ts`                |
| `spec` config slot, `drawer: "spec"` pool | `src/renderSettings.ts`, `src/FeatureChartRenderer/*`     |

Tests that pin this document: `chartSpec.test.ts` (forms, legality matrix, the
four error classes), `chartModel.test.ts` (stable hash),
`painters.test.ts` (yLabel margins, empty input),
`specEquivalence.test.ts` (every legacy drawer == its spec preset, pixel for
pixel), `demoDataContract.test.ts` (the shipped demo spec tracks render).
