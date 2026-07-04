---
id: featurechartrenderer
title: FeatureChartRenderer
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/feature-chart/src/FeatureChartRenderer/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/FeatureChartRenderer.md)

## Docs

### FeatureChartRenderer - Slots

#### slot: drawer

```js
drawer: {
      type: 'string',
      defaultValue: 'tissueBoxPlot',
    }
```

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

#### slot: maxChartsPerView

```js
maxChartsPerView: {
      type: 'number',
      defaultValue: 100,
    }
```

#### slot: minChartSpacingPx

```js
minChartSpacingPx: {
      type: 'number',
      defaultValue: 4,
    }
```

#### slot: colorScheme

```js
colorScheme: {
      type: 'string',
      defaultValue: 'tableau10',
    }
```
