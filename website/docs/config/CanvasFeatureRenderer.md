---
id: canvasfeaturerenderer
title: CanvasFeatureRenderer
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/canvas/src/CanvasFeatureRenderer/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/CanvasFeatureRenderer.md)

## Docs

### CanvasFeatureRenderer - Slots

#### slot: color1

NOTE: intentional fork default (#292421, a near-black). Upstream defaults to
`goldenrod`. This is a permanent project decision, locked by
plugins/linear-genome-view/src/LinearBasicDisplay/model.test.ts

```js
color1: {
      type: 'color',
      description: 'the main color of each feature',
      defaultValue: '#292421',
      contextVariable: ['feature'],
    }
```

#### slot: color2

```js
color2: {
      type: 'color',
      description:
        'the secondary color of each feature, used for connecting lines, etc',
      defaultValue: '#f0f',
      contextVariable: ['feature'],
    }
```

#### slot: color3

```js
color3: {
      type: 'color',
      description:
        'the tertiary color of each feature, often used for contrasting fills, like on UTRs',
      defaultValue: '#357089',
      contextVariable: ['feature'],
    }
```

#### slot: outline

```js
outline: {
      type: 'color',
      description: 'the outline for features',
      defaultValue: '',
      contextVariable: ['feature'],
    }
```

#### slot: colorScheme

Native color scheme. `default` keeps the existing color1/2/3 behavior (including
jexl callbacks). The other values compute the feature color without an
expression.

```js
colorScheme: {
      type: 'stringEnum',
      model: types.enumeration('colorScheme', [
        'default',
        'featureField',
        'score',
        'strand',
        'type',
      ]),
      description:
        'how feature colors are chosen: "default" uses color1/color2/color3, "featureField" reads a color from the feature attribute named by colorField (e.g. the BED itemRgb column), "score" maps a numeric attribute through a continuous palette, "strand" uses color1/color3 for +/-, "type" maps the feature type through a categorical palette',
      defaultValue: 'default',
    }
```

#### slot: colorField

```js
colorField: {
      type: 'string',
      description:
        'feature attribute to read the feature color from when colorScheme is "featureField" (defaults to "color", which the BED/BigBed adapters fill in from itemRgb/reserved)',
      defaultValue: 'color',
    }
```

#### slot: scoreField

```js
scoreField: {
      type: 'string',
      description:
        'feature attribute that holds the numeric score when colorScheme is "score"',
      defaultValue: 'score',
    }
```

#### slot: scorePalette

```js
scorePalette: {
      type: 'string',
      description:
        'continuous palette name used by colorScheme "score" (viridis, plasma, inferno, magma, cividis, coolwarm, ylOrRd, or a registered custom palette)',
      defaultValue: 'viridis',
    }
```

#### slot: scoreScale

```js
scoreScale: {
      type: 'stringEnum',
      model: types.enumeration('scoreScale', ['linear', 'quantile']),
      description:
        'map scores linearly or by quantile rank of the scores in the current render block when colorScheme is "score"',
      defaultValue: 'linear',
    }
```

#### slot: scoreAutoRange

```js
scoreAutoRange: {
      type: 'boolean',
      description:
        'when true (default) derive the score min/max from the features in the current block; set false and use scoreMin/scoreMax for a fixed range',
      defaultValue: true,
    }
```

#### slot: scoreMin

```js
scoreMin: {
      type: 'number',
      description:
        'fixed lower bound for colorScheme "score" (scoreAutoRange false)',
      defaultValue: 0,
    }
```

#### slot: scoreMax

```js
scoreMax: {
      type: 'number',
      description:
        'fixed upper bound for colorScheme "score" (scoreAutoRange false)',
      defaultValue: 1000,
    }
```

#### slot: typePalette

```js
typePalette: {
      type: 'string',
      description:
        'categorical palette name used by colorScheme "type" (e.g. polychrome36, set1, set2, tab10)',
      defaultValue: 'polychrome36',
    }
```

#### slot: colorByCDS

```js
colorByCDS: {
      type: 'boolean',
      description:
        'color CDS features by reading frame instead of using the base feature color',
      defaultValue: false,
    }
```

#### slot: height

```js
height: {
      type: 'number',
      description: 'height in pixels of the main body of each feature',
      defaultValue: 10,
      contextVariable: ['feature'],
    }
```

#### slot: showLabels

```js
showLabels: {
      type: 'boolean',
      defaultValue: true,
    }
```

#### slot: showDescriptions

```js
showDescriptions: {
      type: 'boolean',
      defaultValue: true,
    }
```

#### slot: labelPlacement

NOTE: intentional fork default (`left`). Upstream always places labels below the
feature. This is a permanent project decision, locked by
plugins/linear-genome-view/src/LinearBasicDisplay/model.test.ts

```js
labelPlacement: {
      type: 'stringEnum',
      model: types.enumeration('labelPlacement', ['left', 'below']),
      description:
        'label placement: "left" places labels inline to the left of the feature, "below" places labels underneath the feature',
      defaultValue: 'left',
    }
```

#### slot: subfeatureLabels

```js
subfeatureLabels: {
      type: 'stringEnum',
      model: types.enumeration('subfeatureLabels', [
        'none',
        'below',
        'overlay',
      ]),
      description:
        'subfeature label display: "none" hides labels, "below" reserves extra space, "overlay" draws on top of feature',
      defaultValue: 'none',
    }
```

#### slot: mouseover

```js
mouseover: {
      type: 'string',
      description:
        'the mouseover tooltip label for features. Available variables: feature (the feature object), label (evaluated name), description (evaluated description)',
      defaultValue: `jexl:get(feature,'_mouseover') || get(feature,'_mouseOver') || (label && description ? label + '<br/>' + description : (label || description || ''))`,
      contextVariable: ['feature', 'label', 'description'],
    }
```

#### slot: subfeatureMouseover

```js
subfeatureMouseover: {
      type: 'string',
      description:
        'the mouseover tooltip label for subfeatures (e.g. transcripts). Available variables: feature (the subfeature object)',
      defaultValue: `jexl:get(feature,'name') || get(feature,'id')`,
      contextVariable: ['feature'],
    }
```

#### slot: labels.name

```js
name: {
        type: 'string',
        description:
          'the primary name of the feature to show, if space is available',
        defaultValue: `jexl:get(feature,'name') || get(feature,'id')`,
        contextVariable: ['feature'],
      }
```

#### slot: labels.nameColor

```js
nameColor: {
        type: 'color',
        description: 'the color of the name label, if shown',
        defaultValue: '#f0f',
        contextVariable: ['feature'],
      }
```

#### slot: labels.description

```js
description: {
        type: 'string',
        description: 'the text description to show, if space is available',
        defaultValue: `jexl:get(feature,'note') || get(feature,'description')`,
        contextVariable: ['feature'],
      }
```

#### slot: labels.descriptionColor

```js
descriptionColor: {
        type: 'color',
        description: 'the color of the description, if shown',
        defaultValue: 'blue',
        contextVariable: ['feature'],
      }
```

#### slot: labels.fontSize

```js
fontSize: {
        type: 'number',
        description:
          'height in pixels of the text to use for names and descriptions',
        defaultValue: 12,
        contextVariable: ['feature'],
      }
```

#### slot: displayMode

```js
displayMode: {
      type: 'stringEnum',
      model: types.enumeration('displayMode', [
        'normal',
        'compact',
        'reducedRepresentation',
        'collapse',
      ]),
      description: 'Alternative display modes',
      defaultValue: 'normal',
    }
```

#### slot: maxFeatureGlyphExpansion

```js
maxFeatureGlyphExpansion: {
      type: 'number',
      description:
        "maximum number of pixels on each side of a feature's bounding coordinates that a glyph is allowed to use",
      defaultValue: 500,
    }
```

#### slot: maxHeight

```js
maxHeight: {
      type: 'integer',
      description:
        'the maximum height of the feature layout, i.e. how many stacked feature rows may be drawn. When the layout exceeds this the track shows "Max height reached". This is not the visible track height',
      defaultValue: 5000,
    }
```

#### slot: subParts

```js
subParts: {
      type: 'string',
      description: 'subparts for a glyph',
      defaultValue: 'CDS,UTR,five_prime_UTR,three_prime_UTR',
    }
```

#### slot: impliedUTRs

```js
impliedUTRs: {
      type: 'boolean',
      description: 'imply UTR from the exon and CDS differences',
      defaultValue: false,
    }
```

#### slot: transcriptTypes

```js
transcriptTypes: {
      type: 'stringArray',
      defaultValue: ['mRNA', 'transcript', 'primary_transcript'],
    }
```

#### slot: containerTypes

```js
containerTypes: {
      type: 'stringArray',
      defaultValue: ['proteoform_orf'],
    }
```

#### slot: geneGlyphMode

```js
geneGlyphMode: {
      type: 'stringEnum',
      model: types.enumeration('geneGlyphMode', [
        'all',
        'longest',
        'longestCoding',
      ]),
      description:
        'Gene glyph display mode: "all" shows all transcripts, "longest" shows only the longest transcript, "longestCoding" shows only the longest coding transcript',
      defaultValue: 'all',
    }
```

#### slot: displayDirectionalChevrons

```js
displayDirectionalChevrons: {
      type: 'boolean',
      description:
        'Display directional chevrons on intron lines to indicate strand direction',
      defaultValue: true,
    }
```
