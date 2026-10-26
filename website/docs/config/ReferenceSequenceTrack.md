---
id: referencesequencetrack
title: ReferenceSequenceTrack
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/sequence/src/ReferenceSequenceTrack/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/ReferenceSequenceTrack.md)

## Docs

used to display base level DNA sequence tracks

### ReferenceSequenceTrack - Identifier

#### slot: explicitIdentifier

### ReferenceSequenceTrack - Slots

#### slot: adapter

configuration for track adapter

```js
adapter: pluginManager.pluggableConfigSchemaType('adapter')
```

#### slot: displays

configuration for the displays e.g. LinearReferenceSequenceDisplay

```js
displays: types.array(pluginManager.pluggableConfigSchemaType('display'))
```

#### slot: name

```js
name: {
        type: 'string',
        description: 'optional track name, defaults to "Reference sequence"',
        defaultValue: 'Reference sequence',
      }
```

#### slot: category

```js
category: {
        description: 'the category and sub-categories of a track',
        type: 'stringArray',
        defaultValue: ['Assembly'],
      }
```

#### slot: sequenceType

```js
sequenceType: {
        type: 'string',
        description: 'either dna or pep',
        defaultValue: 'dna',
      }
```

#### slot: description

```js
description: {
        description: 'a description of the track',
        type: 'string',
        defaultValue: '',
      }
```

#### slot: metadata

```js
metadata: {
        type: 'frozen',
        description: 'anything to add about this track',
        defaultValue: {},
      }
```

#### slot: formatAbout.config

```js
config: {
          type: 'frozen',
          description: 'formats configuration in about dialog',
          defaultValue: {},
          contextVariable: ['config'],
        }
```

#### slot: formatAbout.hideUris

```js
hideUris: {
          type: 'boolean',
          defaultValue: false,
        }
```

#### slot: formatAbout.info

```js
info: {
          type: 'text',
          description:
            'markdown template shown in the "About this track" dialog, supports {{path}} interpolation. If the value starts with "jexl:" it is evaluated as an expression',
          defaultValue: '',
          contextVariable: ['track', 'config', 'session', 'assembly'],
        }
```

#### slot: formatAbout.showInfo

```js
showInfo: {
          type: 'boolean',
          description:
            'set to false to hide the track info section of the "About this track" dialog',
          defaultValue: true,
        }
```
