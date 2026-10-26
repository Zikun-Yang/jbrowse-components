---
id: formatabout
title: FormatAbout
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/product-core/src/RootModel/FormatAbout.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/FormatAbout.md)

## Docs

generally exists on the config.json or root config as configuration.formatAbout

### FormatAbout - Slots

#### slot: configuration.formatAbout.config

```js
config: {
      type: 'frozen',
      description: 'formats configuration object in about dialog',
      defaultValue: {},
      contextVariable: ['config'],
    }
```

#### slot: configuration.formatAbout.hideUris

```js
hideUris: {
      type: 'boolean',
      defaultValue: false,
    }
```

#### slot: configuration.formatAbout.info

markdown template shown at the top of the "About this track" dialog. Tracks that
set their own `formatAbout.info` win, this is the site-wide default used by all
tracks that do not. Supports `{{path}}` interpolation and `jexl:` prefixed
expressions.

```js
info: {
      type: 'text',
      description:
        'site-wide default markdown template shown in the "About this track" dialog, supports {{path}} interpolation. If the value starts with "jexl:" it is evaluated as an expression',
      defaultValue: '',
      contextVariable: ['track', 'config', 'session', 'assembly'],
    }
```

#### slot: configuration.formatAbout.showInfo

```js
showInfo: {
      type: 'boolean',
      description:
        'set to false to hide the track info section of the "About this track" dialog for every track',
      defaultValue: true,
    }
```
