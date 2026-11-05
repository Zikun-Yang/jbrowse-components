---
id: sharedgccontentmodel
title: SharedGCContentModel
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/gccontent/src/LinearGCContentDisplay/shared.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/SharedGCContentModel.md)

## Docs

extends

- [LinearWiggleDisplay](../linearwiggledisplay)

### SharedGCContentModel - Properties

#### property: windowSize

manual window size in bp set by the user, undefined means "size the windows from
the view", see windowSizeSetting

```js
// type signature
IMaybe<ISimpleType<number>>
// code
windowSize: types.maybe(types.number)
```

#### property: windowDelta

```js
// type signature
IMaybe<ISimpleType<number>>
// code
windowDelta: types.maybe(types.number)
```

### SharedGCContentModel - Getters

#### getter: windowSizeFromView

window size in bp for the current view: one window per
GC_CONTENT_PIXELS_PER_WINDOW screen pixels, so the resolution grows as the view
zooms out and the number of windows across the view follows the view width

```js
// type
number
```

#### getter: windowSizeSetting

a windowSize of 0 (the default for the GC content display on the reference
sequence track) means the windows are sized from the view

```js
// type
number
```

#### getter: windowDeltaSetting

```js
// type
number
```

#### getter: trackLabelLeftText

the window size and step size in bp, shown at the left end of the track label
row (see plugins/linear-genome-view TrackLabelContainer) so that the resolution
behind the plot is readable without opening the track menu

```js
// type
string
```

### SharedGCContentModel - Methods

#### method: adapterProps

retrieves the sequence adapter from parent track, and puts it as a subadapter on
a GCContentAdapter

```js
// type signature
adapterProps: () => any
```

### SharedGCContentModel - Actions

#### action: setGCContentParams

```js
// type signature
setGCContentParams: ({ windowSize, windowDelta, }: { windowSize?: number | undefined; windowDelta?: number | undefined; }) => void
```

#### action: resetGCContentParams

drop the manual window size and size the windows from the view again

```js
// type signature
resetGCContentParams: () => void
```
