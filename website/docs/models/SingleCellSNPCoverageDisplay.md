---
id: singlecellsnpcoveragedisplay
title: SingleCellSNPCoverageDisplay
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/single-cell/src/SingleCellView/SingleCellSNPCoverageDisplay/model.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/SingleCellSNPCoverageDisplay.md)

## Docs

A LinearSNPCoverageDisplay variant that injects the current single-cell
selection into adapter props. The underlying SingleCellBamAdapter uses
`selectedCells` to filter reads by cell barcode before coverage is computed.

### SingleCellSNPCoverageDisplay - Methods

#### method: adapterProps

Add selected cell barcodes to the props passed to the adapter.

```js
// type signature
adapterProps: () => { selectedCells: Set<string>; }
```

### SingleCellSNPCoverageDisplay - Actions

#### action: getCellBarcodesInRegion

Return the set of cell barcodes (CB/CR tags) observed in the given genomic
region. Used by SingleCellView for genome → cell highlighting.

```js
// type signature
getCellBarcodesInRegion: (region: Region) => Promise<Set<string>>
```
