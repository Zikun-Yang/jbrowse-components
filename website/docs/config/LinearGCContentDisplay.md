---
id: lineargccontentdisplay
title: LinearGCContentDisplay
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/gccontent/src/LinearGCContentDisplay/config1.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/LinearGCContentDisplay.md)

## Docs

extends LinearWiggleDisplay

### LinearGCContentDisplay - Slots

#### slot: windowSize

size in bp of the window that GC content is calculated over, or 0 to size the
windows from the view (one window per 2 screen pixels, so the number of windows
follows the view width and the resolution follows the zoom level)

```js
windowSize: {
        type: 'number',
        defaultValue: 0,
      }
```

#### slot: windowDelta

step in bp between GC content windows, or 0 to match the window size that is
used

```js
windowDelta: {
        type: 'number',
        defaultValue: 0,
      }
```

### LinearGCContentDisplay - Derives from

```js
baseConfiguration: pluginManager.getDisplayType('LinearWiggleDisplay')!
        .configSchema
```
