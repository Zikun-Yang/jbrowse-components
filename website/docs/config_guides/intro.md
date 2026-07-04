---
id: intro
title: Intro to the config.json format
---

A JBrowse 2 configuration for jbrowse-web is stored in a file (often called
config.json) and is structured as follows

```json
{
  "configuration": {
    /* global configs here */
  },
  "assemblies": [
    /* list of assembly configurations, e.g. the genomes being viewed */
  ],
  "tracks": [
    /* array of tracks being loaded, contain reference to which assembl(y/ies)
    they belong to */
  ],
  "aggregateTextSearchAdapters": [
    /* optional array of text search adapters */
  ],
  "defaultSession": {
    /* optional default session */
  },
  "includes": [
    /* optional list of paths or URLs to additional config files to merge */
  ]
}
```

The most important thing to configure are your assemblies and your tracks.

## Splitting config across multiple files

You can use the `includes` field to split a large config into smaller files. For
example, you can keep global settings in the root `config.json` and put each
assembly's tracks in a separate file:

```json
// config.json
{
  "configuration": {
    /* global settings */
  },
  "includes": ["assemblies/hg19.json", "assemblies/hg38.json"],
  "defaultSession": { "name": "New Session" }
}
```

```json
// assemblies/hg19.json
{
  "assemblies": [{ "name": "hg19" /* ... */ }],
  "tracks": [
    /* tracks for hg19 */
  ]
}
```

Paths in `includes` are resolved relative to the config file that declares them,
and `includes` can be nested. If the same `trackId` or assembly `name` appears
in multiple files, the first occurrence (with the root config having highest
priority) is used.

:::info

Note: On jbrowse desktop, a "session" is essentially a complete JBrowse config
with a .jbrowse file extension

:::

:::info

Note: with embedded components e.g. @jbrowse/react-linear-genome-view, it does
not accept a config file but rather an object at runtime with the config loaded.

To fetch a config.json object on the fly in @jbrowse/react-linear-genome-view,
you might use something like this:

```typescript
const response = await fetch('config.json')
if (!response.ok) {
  throw new Error(`HTTP status ${response.status} fetching ${url}`)
}
const config = await response.json()
createViewState({
  ...config,
  assembly: config.assemblies[0], // only one assembly used in embedded currently)
})
```

:::
