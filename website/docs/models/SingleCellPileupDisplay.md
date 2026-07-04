---
id: singlecellpileupdisplay
title: SingleCellPileupDisplay
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/single-cell/src/SingleCellView/SingleCellPileupDisplay/model.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/SingleCellPileupDisplay.md)

## Docs

A LinearPileupDisplay variant that injects the current single-cell selection
into adapter render props. The SingleCellBamAdapter uses `selectedCells` to
filter reads by cell barcode.

### SingleCellPileupDisplay - Methods

#### method: adapterRenderProps

Add selected cell barcodes to the props passed to the adapter.

```js
// type signature
adapterRenderProps: () => { selectedCells: Set<string>; }
```

### SingleCellPileupDisplay - Actions

#### action: getCellBarcodesInRegion

Return the set of cell barcodes (CB/CR tags) observed in the given genomic
region. Used by SingleCellView for genome → cell highlighting.

```js
// type signature
getCellBarcodesInRegion: (region: Region) => Promise<Set<string>>
```
