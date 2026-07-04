---
id: configuration.singlecellplugin
title: configuration.SingleCellPlugin
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/single-cell/src/index.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/configuration.SingleCellPlugin.md)

## Docs

### configuration.SingleCellPlugin - Slots

#### slot: datasets

Preset single-cell datasets shown in the SingleCellView import form. Each entry
should have { name: string, uri: string }.

```js
datasets: {
      type: 'frozen',
      defaultValue: [],
    }
```
