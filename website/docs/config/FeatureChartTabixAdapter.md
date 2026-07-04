---
id: featurecharttabixadapter
title: FeatureChartTabixAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/feature-chart/src/FeatureChartAdapter/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/FeatureChartTabixAdapter.md)

## Docs

### FeatureChartTabixAdapter - Pre-processor / simplified config

Allows minimal config:

```json
{
  "type": "FeatureChartTabixAdapter",
  "uri": "yourfile.tsv.gz"
}
```

### FeatureChartTabixAdapter - Slots

#### slot: dataLocation

```js
dataLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/my.tsv.gz',
        locationType: 'UriLocation',
      },
    }
```

#### slot: index

```js
index: ConfigurationSchema('FeatureChartTabixIndex', {
  indexType: {
    model: types.enumeration('IndexType', ['TBI', 'CSI']),
    type: 'stringEnum',
    defaultValue: 'TBI',
  },

  location: {
    type: 'fileLocation',
    defaultValue: {
      uri: '/path/to/my.tsv.gz.tbi',
      locationType: 'UriLocation',
    },
  },
})
```

#### slot: index.indexType

```js
indexType: {
        model: types.enumeration('IndexType', ['TBI', 'CSI']),
        type: 'stringEnum',
        defaultValue: 'TBI',
      }
```

#### slot: index.location

```js
location: {
        type: 'fileLocation',
        defaultValue: {
          uri: '/path/to/my.tsv.gz.tbi',
          locationType: 'UriLocation',
        },
      }
```

#### slot: format

```js
format: {
      type: 'stringEnum',
      model: types.enumeration('FeatureChartFormat', ['tsv-json-payload']),
      defaultValue: 'tsv-json-payload',
    }
```
