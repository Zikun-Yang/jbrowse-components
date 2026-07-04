---
id: singlecellbamadapter
title: SingleCellBamAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/single-cell/src/SingleCellAdapter/SingleCellBamAdapterConfigSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/SingleCellBamAdapter.md)

## Docs

Wraps a BAM/CRAM adapter and filters features by a cell barcode tag.

### SingleCellBamAdapter - Slots

#### slot: subadapter

Underlying BAM/CRAM adapter config

```js
subadapter: {
      type: 'frozen',
      defaultValue: null,
    }
```

#### slot: cellBarcodeTag

SAM tag that holds the cell barcode (default: 10x CB)

```js
cellBarcodeTag: {
      type: 'string',
      defaultValue: 'CB',
    }
```
