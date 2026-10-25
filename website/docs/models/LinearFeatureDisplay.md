---
id: linearfeaturedisplay
title: LinearFeatureDisplay
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-genome-view/src/LinearFeatureDisplay/model.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/LinearFeatureDisplay.md)

## Docs

Base model for feature displays. Provides labels, descriptions, display modes,
filters, etc. Does not include gene glyph functionality.

extends

- [BaseLinearDisplay](../baselineardisplay)

### LinearFeatureDisplay - Properties

#### property: type

```js
// type signature
ISimpleType<"LinearFeatureDisplay">
// code
type: types.literal('LinearFeatureDisplay')
```

#### property: trackShowLabels

```js
// type signature
IMaybe<ISimpleType<boolean>>
// code
trackShowLabels: types.maybe(types.boolean)
```

#### property: trackShowDescriptions

```js
// type signature
IMaybe<ISimpleType<boolean>>
// code
trackShowDescriptions: types.maybe(types.boolean)
```

#### property: trackDisplayMode

```js
// type signature
IMaybe<ISimpleType<string>>
// code
trackDisplayMode: types.maybe(types.string)
```

#### property: trackMaxHeight

```js
// type signature
IMaybe<ISimpleType<number>>
// code
trackMaxHeight: types.maybe(types.number)
```

#### property: configuration

```js
// type signature
AnyConfigurationSchemaType
// code
configuration: ConfigurationReference(configSchema)
```

#### property: jexlFiltersSetting

```js
// type signature
IMaybe<IArrayType<ISimpleType<string>>>
// code
jexlFiltersSetting: types.maybe(types.array(types.string))
```

### LinearFeatureDisplay - Getters

#### getter: showLabels

Whether to show feature labels. Falls back to renderer.showLabels when the track
override is not set

```js
// type
boolean
```

#### getter: showDescriptions

Whether to show feature descriptions. Falls back to renderer.showDescriptions
when the track override is not set

```js
// type
boolean
```

#### getter: displayMode

Display mode (normal, compact, reducedRepresentation, collapse). Falls back to
renderer.displayMode when the track override is not set

```js
// type
string
```

#### getter: maxHeight

Maximum layout height. Falls back to renderer.maxHeight when the track override
is not set

```js
// type
number
```

#### getter: rendererTypeName

```js
// type
any
```

#### getter: sequenceAdapter

```js
// type
any
```

#### getter: trackOverrides

Track overrides merged into rendererConfig. Subclasses extend this list to add
their own overrides; the getters, actions and snapshot pruning are generated
from it by ./trackOverrides.ts

```js
// type
readonly TrackOverride[]
```

#### getter: rendererConfig

```js
// type
any
```

#### getter: featureUnderMouse

Override featureUnderMouse to return the volatile feature which is fetched
asynchronously via CoreGetFeatureDetails

```js
// type
Feature | undefined
```

### LinearFeatureDisplay - Methods

#### method: activeFilters

```js
// type signature
activeFilters: () => string[]
```

#### method: renderProps

```js
// type signature
renderProps: () => {
  config: any
  filters: SerializableFilterChain
  sequenceAdapter: any
}
```

#### method: renderingProps

```js
// type signature
renderingProps: () => { onFeatureClick(_: unknown, featureId?: string | undefined): Promise<void>; displayModel: { id: string; type: string; rpcDriverName: string | undefined; } & NonEmptyObject & { ...; } & { ...; } & IStateTreeNode<...>; }
```

#### method: filterMenuItems

```js
// type signature
filterMenuItems: () => MenuItem[]
```

#### method: featureStyleMenuItems

Style items appended to the "Show..." menu. Subclasses override this instead of
locating the submenu by label: a label lookup silently drops its items when the
parent menu changes, while an override point cannot.

```js
// type signature
featureStyleMenuItems: () => MenuItem[]
```

#### method: trackMenuItems

```js
// type signature
trackMenuItems: () => MenuItem[]
```

### LinearFeatureDisplay - Actions

#### action: toggleShowLabels

Toggle whether feature labels are shown

```js
// type signature
toggleShowLabels: () => void
```

#### action: toggleShowDescriptions

Toggle whether feature descriptions are shown

```js
// type signature
toggleShowDescriptions: () => void
```

#### action: setDisplayMode

Set the display mode of the track

```js
// type signature
setDisplayMode: (val: string) => void
```

#### action: setMaxHeight

Set the maximum layout height of the track

```js
// type signature
setMaxHeight: (val?: number | undefined) => void
```

#### action: setJexlFilters

```js
// type signature
setJexlFilters: (f?: string[] | undefined) => void
```

#### action: setFeatureUnderMouse

```js
// type signature
setFeatureUnderMouse: (feat?: Feature | undefined) => void
```

#### action: fetchFeatureDetails

Fetch full feature details through CoreGetFeatureDetails, with a small LRU cache
and in-flight de-duplication. Shared by the hover tooltip reaction and by
feature clicks so repeated interactions with the same feature never issue a
second RPC.

```js
// type signature
fetchFeatureDetails: (featureId: string) => Promise<Feature | undefined>
```

#### action: clearFeatureDetailsCache

```js
// type signature
clearFeatureDetailsCache: () => void
```
