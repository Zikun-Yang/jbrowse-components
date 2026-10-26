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

Name of the drawer that paints each chart. Either one of the built-in drawers
(`precomputedBoxPlot`, `rawBoxPlot`, `rawViolinPlot`, `barPlot`, `histogram`,
`spec`), or a drawer contributed by a plugin as `<pluginName>/<drawerName>`
through the `Core-featureChartDrawer` extension point. Unknown names render a
placeholder instead of failing the track; a placeholder that says "missing
plugin" usually means the drawer's plugin is not listed in `config.plugins`.

```js
drawer: {
      type: 'string',
      defaultValue: 'precomputedBoxPlot',
    }
```

#### slot: drawerOptions

Arbitrary JSON handed to the drawer as `DrawerProps.options`, so one drawer can
render several variants (colors, sizes, ramps, …) without a new registration.
Not validated by the config editor: each drawer documents the keys it reads in
`FeatureChartDrawerMeta.optionsSchema` and clamps out-of-range values itself.

```js
drawerOptions: {
      type: 'frozen',
      defaultValue: {},
    }
```

#### slot: spec

Declarative chart description, read only when `drawer` is `"spec"`:

```json
{
  "specVersion": 1,
  "kind": "box",
  "data": { "form": "grouped-values", "path": "tissues" }
}
```

The v1 vocabulary is frozen and documented in `plugins/feature-chart/SPEC.md`:
four `kind` values (`box`, `violin`, `bar`, `histogram`), four `data.form`
values and the five legal combinations between them. Nothing here is executable
code, so a spec can travel in a shared session.

Invalid specs render a readable placeholder and, in the maximize dialog, a list
of every problem (`path` + `allowed` + the keys actually present) — they never
fail the track.

```js
spec: {
      type: 'frozen',
      defaultValue: {},
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

Palette used by the built-in drawers. One of `tableau10`, `viridis`, `set2`,
`dark2`, `blues` (see `listColorSchemeNames()`).

```js
colorScheme: {
      type: 'string',
      defaultValue: 'tableau10',
    }
```
