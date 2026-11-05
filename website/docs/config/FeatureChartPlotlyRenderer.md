---
id: featurechartplotlyrenderer
title: FeatureChartPlotlyRenderer
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/feature-chart/src/FeatureChartPlotlyRenderer/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/FeatureChartPlotlyRenderer.md)

## Docs

### FeatureChartPlotlyRenderer - Slots

#### slot: chartHeight

```js
chartHeight: {
      type: 'number',
      defaultValue: 180,
    }
```

#### slot: chartWidth

```js
chartWidth: {
      type: 'number',
      defaultValue: 120,
    }
```

#### slot: align

```js
align: {
      type: 'stringEnum',
      model: types.enumeration('ChartAlign', ['left', 'right', 'center']),
      defaultValue: 'center',
    }
```

#### slot: plotType

**Deprecated.** Kept as a compatibility alias for `spec.kind`, so a track
written before the two backends were unified keeps rendering. It is only
consulted when `drawer` is left at its default; any explicit `drawer` (including
`"spec"`) wins, and using `plotType` logs one deprecation warning with the
equivalent spec.

Migration:

```json
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

`scatter` and `line` have no `ChartModel` in the v1 vocabulary (no canvas
painter exists for them); they keep their legacy Plotly rendering under the same
warning and are removed in v2.

```js
plotType: {
      type: 'stringEnum',
      model: types.enumeration('PlotlyPlotType', [
        'box',
        'bar',
        'scatter',
        'line',
        'violin',
      ]),
      defaultValue: 'box',
    }
```

#### slot: colorScheme

```js
colorScheme: {
      type: 'string',
      defaultValue: 'tableau10',
    }
```

#### slot: drawerOptions

Per-drawer options (`DrawerProps.options`), passed to the same drawer model
builder the canvas renderer uses (see `drawerRegistry.ts`).

```js
drawerOptions: {
      type: 'frozen',
      defaultValue: {},
    }
```

#### slot: spec

Declarative chart description (`plugins/feature-chart/SPEC.md`), rendered when
`drawer` is `"spec"` — now by _both_ backends, from the same normalized
`ChartModel`, so a spec chart looks the same in a track and in the
interactive/maximized view.

```js
spec: {
      type: 'frozen',
      defaultValue: {},
    }
```

#### slot: renderCache

Accepted so a track can switch between `FeatureChartRenderer` and this renderer
without losing configuration. Plotly keeps its own plot instances (no canvas
blitting), so this slot has no effect here.

```js
renderCache: {
      type: 'boolean',
      defaultValue: true,
    }
```
