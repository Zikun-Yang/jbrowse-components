---
id: linearcomparativeview
title: LinearComparativeView
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-comparative-view/src/LinearComparativeView/model.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/LinearComparativeView.md)

## Docs

extends

- [BaseViewModel](../baseviewmodel)

### LinearComparativeView - Properties

#### property: id

```js
// type signature
IOptionalIType<ISimpleType<string>, [undefined]>
// code
id: ElementId
```

#### property: type

```js
// type signature
ISimpleType<"LinearComparativeView">
// code
type: types.literal('LinearComparativeView')
```

#### property: trackSelectorType

```js
// type signature
string
// code
trackSelectorType: 'hierarchical'
```

#### property: showIntraviewLinks

```js
// type signature
true
// code
showIntraviewLinks: true
```

#### property: linkViews

```js
// type signature
false
// code
linkViews: false
```

#### property: followSynteny

when enabled, navigating in one sub-view re-centers the other sub-views on the
syntenically corresponding position

```js
// type signature
false
// code
followSynteny: false
```

#### property: followCumulativePct

when followSynteny maps a window onto multiple chromosomes, keep only the top
chromosomes (by aligned overlap, descending) whose cumulative overlap reaches
this percentage of the total, filtering out spurious repeat-induced hits; 100
keeps all

```js
// type signature
number
// code
followCumulativePct: 90
```

#### property: rainbowAnchor

index of the sub-view whose genome anchors rainbow (query position) coloring:
features in every synteny display are colored by where they map onto this
genome's coordinates

```js
// type signature
number
// code
rainbowAnchor: 0
```

#### property: interactiveOverlay

```js
// type signature
false
// code
interactiveOverlay: false
```

#### property: showDynamicControls

```js
// type signature
true
// code
showDynamicControls: true
```

#### property: levels

```js
// type signature
IArrayType<IAnyModelType>
// code
levels: types.array(LinearSyntenyViewHelper!)
```

#### property: views

currently this is limited to an array of two

```js
// type signature
IArrayType<IModelType<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; displayName: IMaybe<ISimpleType<string>>; minimized: IType<boolean | undefined, boolean, boolean>; } & { ...; }, { ...; } & ... 16 more ... & { ...; }, ModelCreationType<...>, ModelSnapshotType<...>>>
// code
views: types.array(
          pluginManager.getViewType('LinearGenomeView')!
            .stateModel as LinearGenomeViewStateModel,
        )
```

#### property: viewTrackConfigs

this represents tracks specific to this view specifically used for read vs ref
dotplots where this track would not really apply elsewhere

```js
// type signature
IArrayType<IAnyModelType>
// code
viewTrackConfigs: types.array(
          pluginManager.pluggableConfigSchemaType('track'),
        )
```

### LinearComparativeView - Getters

#### getter: initialized

```js
// type
boolean
```

#### getter: refNames

```js
// type
string[][]
```

#### getter: assemblyNames

```js
// type
string[]
```

#### getter: loadingMessage

```js
// type
'Loading' | undefined
```

#### getter: showLoading

Whether to show a loading indicator instead of the import form or view

```js
// type
boolean
```

### LinearComparativeView - Methods

#### method: followFromView

synteny-aware follow: re-center other sub-views after a navigation in the given
source sub-view. no-op here, overridden by LinearSyntenyView

```js
// type signature
followFromView: (_source: unknown) => Promise<void>
```

#### method: headerMenuItems

includes a subset of view menu options because the full list is a little
overwhelming. overridden by subclasses

```js
// type signature
headerMenuItems: () => MenuItem[]
```

#### method: menuItems

```js
// type signature
menuItems: () => MenuItem[]
```

#### method: rubberBandMenuItems

```js
// type signature
rubberBandMenuItems: () => { label: string; onClick: () => void; }[]
```

### LinearComparativeView - Actions

#### action: setLastNavSource

```js
// type signature
setLastNavSource: (source: unknown) => void
```

#### action: setWidth

```js
// type signature
setWidth: (newWidth: number) => void
```

#### action: setIsLoading

```js
// type signature
setIsLoading: (arg: boolean) => void
```

#### action: setViews

```js
// type signature
setViews: (views: ModelCreationType<ExtractCFromProps<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; displayName: IMaybe<ISimpleType<string>>; minimized: IType<boolean | undefined, boolean, boolean>; } & { ...; }>>[]) => void
```

#### action: removeView

```js
// type signature
removeView: (view: { id: string; displayName: string | undefined; minimized: boolean; type: string; offsetPx: number; bpPerPx: number; displayedRegions: Region[] & IStateTreeNode<IOptionalIType<IType<Region[], Region[], Region[]>, [...]>>; ... 12 more ...; init: (InitState & IStateTreeNode<...>) | undefined; } & ... 19 more ......
```

#### action: setLevelHeight

```js
// type signature
setLevelHeight: (newHeight: number, level?: number) => any
```

#### action: setLinkViews

```js
// type signature
setLinkViews: (arg: boolean) => void
```

#### action: setFollowSynteny

```js
// type signature
setFollowSynteny: (arg: boolean) => void
```

#### action: setFollowCumulativePct

```js
// type signature
setFollowCumulativePct: (arg: number) => void
```

#### action: setRainbowAnchor

```js
// type signature
setRainbowAnchor: (arg: number) => void
```

#### action: incFollowing

```js
// type signature
incFollowing: () => void
```

#### action: decFollowing

```js
// type signature
decFollowing: () => void
```

#### action: incFollowSeq

```js
// type signature
incFollowSeq: () => number
```

#### action: setLastApplied

```js
// type signature
setLastApplied: (id: string, val: { refName: string; coord: number; }) => void
```

#### action: setShowDynamicControls

```js
// type signature
setShowDynamicControls: (arg: boolean) => void
```

#### action: activateTrackSelector

```js
// type signature
activateTrackSelector: (level: number) => Widget
```

#### action: toggleTrack

```js
// type signature
toggleTrack: (trackId: string, level?: number) => void
```

#### action: showTrack

```js
// type signature
showTrack: (trackId: string, level?: number, initialSnapshot?: {}) => void
```

#### action: hideTrack

```js
// type signature
hideTrack: (trackId: string, level?: number) => void
```

#### action: squareView

```js
// type signature
squareView: () => void
```

#### action: clearView

```js
// type signature
clearView: () => void
```
