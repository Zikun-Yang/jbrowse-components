---
id: lineargccontentdisplay
title: LinearGCContentDisplay
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/gccontent/src/LinearGCContentDisplay/stateModel1.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/LinearGCContentDisplay.md)

## Docs

base model `SharedGCContentModel`

### LinearGCContentDisplay - Properties

#### property: autoSwitchGCContent

true when the reference sequence display handed the track over automatically
because the view was zoomed out too far to render bases (see
plugins/sequence/src/LinearReferenceSequenceDisplay/model.ts). only then does
this display hand the track back when zoomed in again: a GC content display
picked by hand stays put.

```js
// type signature
IMaybe<ISimpleType<boolean>>
// code
autoSwitchGCContent: types.maybe(types.boolean)
```
