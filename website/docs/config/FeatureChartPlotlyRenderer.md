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

Per-drawer options (`DrawerProps.options`). Accepted here so a track can switch
between this renderer and `FeatureChartRenderer` without losing its
configuration. The Plotly backend does not consume drawers yet (see
ARCHITECTURE.md, WP4): the slot is carried, not applied.

```js
drawerOptions: {
      type: 'frozen',
      defaultValue: {},
    }
```

#### slot: spec

Declarative chart description (`plugins/feature-chart/SPEC.md`). Accepted on
this renderer so switching renderers keeps a track's configuration intact, but
**the Plotly backend does not render specs yet**: with `drawer: "spec"` it shows
an explicit "not supported here" warning instead of pretending (unifying both
backends is WP4). Use `FeatureChartRenderer` for spec charts.

```js
spec: {
      type: 'frozen',
      defaultValue: {},
    }
```
