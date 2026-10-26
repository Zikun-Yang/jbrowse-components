---
id: linearbasicdisplay
title: LinearBasicDisplay
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-genome-view/src/LinearBasicDisplay/model.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/LinearBasicDisplay.md)

## Docs

Used by `FeatureTrack`, has simple settings like "show/hide feature labels",
plus gene glyph display options.

extends

- [LinearFeatureDisplay](../linearfeaturedisplay)

### LinearBasicDisplay - Properties

#### property: type

```js
// type signature
ISimpleType<"LinearBasicDisplay">
// code
type: types.literal('LinearBasicDisplay')
```

#### property: trackGeneGlyphMode

```js
// type signature
IMaybe<ISimpleType<string>>
// code
trackGeneGlyphMode: types.maybe(types.string)
```

#### property: trackSubfeatureLabels

```js
// type signature
IMaybe<ISimpleType<string>>
// code
trackSubfeatureLabels: types.maybe(types.string)
```

#### property: trackLabelPlacement

```js
// type signature
IMaybe<ISimpleType<string>>
// code
trackLabelPlacement: types.maybe(types.string)
```

#### property: trackDisplayDirectionalChevrons

```js
// type signature
IMaybe<ISimpleType<boolean>>
// code
trackDisplayDirectionalChevrons: types.maybe(types.boolean)
```

#### property: trackColorScheme

```js
// type signature
IMaybe<ISimpleType<string>>
// code
trackColorScheme: types.maybe(types.string)
```

#### property: trackScorePalette

```js
// type signature
IMaybe<ISimpleType<string>>
// code
trackScorePalette: types.maybe(types.string)
```

#### property: trackTypePalette

```js
// type signature
IMaybe<ISimpleType<string>>
// code
trackTypePalette: types.maybe(types.string)
```

#### property: configuration

```js
// type signature
AnyConfigurationSchemaType
// code
configuration: ConfigurationReference(configSchema)
```

### LinearBasicDisplay - Getters

#### getter: geneGlyphMode

Gene glyph mode (all, longest, longestCoding). Falls back to
renderer.geneGlyphMode when the track override is not set

```js
// type
string
```

#### getter: subfeatureLabels

Subfeature label mode (none, below, overlay). Falls back to
renderer.subfeatureLabels when the track override is not set

```js
// type
string
```

#### getter: labelPlacement

Label placement (left, below). Falls back to renderer.labelPlacement when the
track override is not set

```js
// type
string
```

#### getter: displayDirectionalChevrons

Whether to draw directional chevrons on introns. Falls back to
renderer.displayDirectionalChevrons when the track override is not set

```js
// type
boolean
```

#### getter: colorScheme

How feature colors are chosen (default, featureField, score, strand, type).
Falls back to renderer.colorScheme when the track override is not set

```js
// type
string
```

#### getter: scorePalette

Continuous palette used by colorScheme "score". Falls back to
renderer.scorePalette when the track override is not set

```js
// type
string
```

#### getter: typePalette

Categorical palette used by colorScheme "type". Falls back to
renderer.typePalette when the track override is not set

```js
// type
string
```

#### getter: trackOverrides

Base feature display overrides plus the gene/label ones

```js
// type
readonly TrackOverride[]
```

#### getter: colorLegend

Legend rows for the active color scheme, built from the data the renderer
reported for the visible blocks (score range, feature type counts). Cached by
MobX until a block finishes rendering or the color config changes.

```js
// type
LegendItem[]
```

### LinearBasicDisplay - Methods

#### method: legendItems

Legend shown by BaseLinearDisplay when "Show legend" is enabled

```js
// type signature
legendItems: () => LegendItem[]
```

#### method: featureStyleMenuItems

Gene/label style options appended to the "Show..." menu by the base display's
featureStyleMenuItems() hook

```js
// type signature
featureStyleMenuItems: () => MenuItem[]
```

#### method: colorMenuItems

"Color by..." menu. Feature colors are rendered by CanvasFeatureRenderer, so the
entries only make sense here (not on the shared LinearFeatureDisplay that
variant tracks also extend).

```js
// type signature
colorMenuItems: () => MenuItem[]
```

### LinearBasicDisplay - Actions

#### action: setGeneGlyphMode

Set the gene glyph mode

```js
// type signature
setGeneGlyphMode: (val: string) => void
```

#### action: setSubfeatureLabels

Set the subfeature label mode

```js
// type signature
setSubfeatureLabels: (val: string) => void
```

#### action: setLabelPlacement

Set the label placement (left or below)

```js
// type signature
setLabelPlacement: (val: string) => void
```

#### action: toggleDisplayDirectionalChevrons

Toggle directional chevrons on introns

```js
// type signature
toggleDisplayDirectionalChevrons: () => void
```

#### action: setColorScheme

Set how feature colors are chosen

```js
// type signature
setColorScheme: (val: string) => void
```

#### action: setScorePalette

Set the continuous palette used by the score color scheme

```js
// type signature
setScorePalette: (val: string) => void
```

#### action: setTypePalette

Set the categorical palette used by the type color scheme

```js
// type signature
setTypePalette: (val: string) => void
```
