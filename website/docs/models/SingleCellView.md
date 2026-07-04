---
id: singlecellview
title: SingleCellView
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/single-cell/src/SingleCellView/model.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/SingleCellView.md)

## Docs

extends

- [BaseViewModel](../baseviewmodel)

### SingleCellView - Properties

#### property: type

```js
// type signature
ISimpleType<"SingleCellView">
// code
type: types.literal('SingleCellView')
```

#### property: dataset

Dataset URI (typically a Zarr directory URL)

```js
// type signature
IMaybe<ISimpleType<string>>
// code
dataset: types.maybe(types.string)
```

#### property: embedding

Current embedding name, e.g. 'X_umap', 'X_pca'

```js
// type signature
IMaybe<ISimpleType<string>>
// code
embedding: types.maybe(types.string)
```

#### property: colorBy

Current color-by target: either an obs column, a gene/peak feature, or a gene
set.

```js
// type signature
IMaybe<IModelType<{ kind: ISimpleType<string>; name: ISimpleType<string>; }, {}, _NotCustomized, _NotCustomized>>
// code
colorBy: types.maybe(
          types.model({
            kind: types.enumeration(['obs', 'feature', 'geneSet']),
            name: types.string,
          }),
        )
```

#### property: error

```js
// type signature
IMaybe<ISimpleType<string>>
// code
error: types.maybe(types.string)
```

#### property: selectionTool

Selection tool mode

```js
// type signature
IOptionalIType<ISimpleType<string>, [undefined]>
// code
selectionTool: types.optional(
          types.enumeration(['pan', 'lasso', 'rect']),
          'pan',
        )
```

#### property: selectedLabels

Selected categorical labels per obs column.

```js
// type signature
IMapType<IArrayType<ISimpleType<string>>>
// code
selectedLabels: types.map(types.array(types.string))
```

#### property: selectedRanges

Selected continuous ranges per obs column.

```js
// type signature
IMapType<IModelType<{ min: ISimpleType<number>; max: ISimpleType<number>; }, {}, _NotCustomized, _NotCustomized>>
// code
selectedRanges: types.map(RangeModel)
```

#### property: obsTransforms

X/Y axis transforms per obs continuous column.

```js
// type signature
IMapType<IModelType<{ x: ISimpleType<"log" | "linear">; y: ISimpleType<"log" | "linear">; }, {}, _NotCustomized, _NotCustomized>>
// code
obsTransforms: types.map(AxisTransformsModel)
```

#### property: activeFeatures

Active gene/peak features shown in the right sidebar.

```js
// type signature
IArrayType<ISimpleType<string>>
// code
activeFeatures: types.array(types.string)
```

#### property: selectedFeature

Currently selected feature in the right sidebar histogram.

```js
// type signature
IMaybe<ISimpleType<string>>
// code
selectedFeature: types.maybe(types.string)
```

#### property: featureRanges

Selected value ranges per feature name.

```js
// type signature
IMapType<IModelType<{ min: ISimpleType<number>; max: ISimpleType<number>; }, {}, _NotCustomized, _NotCustomized>>
// code
featureRanges: types.map(RangeModel)
```

#### property: featureTransforms

X/Y axis transforms per feature name.

```js
// type signature
IMapType<IModelType<{ x: ISimpleType<"log" | "linear">; y: ISimpleType<"log" | "linear">; }, {}, _NotCustomized, _NotCustomized>>
// code
featureTransforms: types.map(AxisTransformsModel)
```

#### property: activeGeneSets

Active gene sets shown in the right sidebar.

```js
// type signature
IArrayType<ISimpleType<string>>
// code
activeGeneSets: types.array(types.string)
```

#### property: selectedGeneSet

Currently selected gene set in the right sidebar histogram.

```js
// type signature
IMaybe<ISimpleType<string>>
// code
selectedGeneSet: types.maybe(types.string)
```

#### property: geneSets

User-defined gene sets: name -> list of gene names.

```js
// type signature
IMapType<IArrayType<ISimpleType<string>>>
// code
geneSets: types.map(types.array(types.string))
```

#### property: geneSetRanges

Selected value ranges per gene set name.

```js
// type signature
IMapType<IModelType<{ min: ISimpleType<number>; max: ISimpleType<number>; }, {}, _NotCustomized, _NotCustomized>>
// code
geneSetRanges: types.map(RangeModel)
```

#### property: geneSetTransforms

X/Y axis transforms per gene set name.

```js
// type signature
IMapType<IModelType<{ x: ISimpleType<"log" | "linear">; y: ISimpleType<"log" | "linear">; }, {}, _NotCustomized, _NotCustomized>>
// code
geneSetTransforms: types.map(AxisTransformsModel)
```

#### property: geneSetAggregatorKeys

Aggregation method key per gene set name.

```js
// type signature
IMapType<ISimpleType<string>>
// code
geneSetAggregatorKeys: types.map(types.string)
```

#### property: width

```js
// type signature
number
// code
width: 800
```

#### property: height

```js
// type signature
number
// code
height: 600
```

#### property: loading

```js
// type signature
false
// code
loading: false
```

#### property: data

Loaded dataset data (frozen to avoid MST deep observation overhead)

```js
// type signature
SingleCellDataset | undefined
// code
data: undefined as SingleCellDataset | undefined
```

#### property: adapter

Adapter instance used to load embeddings and metadata on demand

```js
// type signature
SingleCellZarrAdapter | undefined
// code
adapter: undefined as SingleCellZarrAdapter | undefined
```

#### property: selectedCells

Selected cell indices

```js
// type signature
Set<number>
// code
selectedCells: new Set<number>() as Set<number>
```

#### property: highlightedCells

Highlighted cell indices (hover)

```js
// type signature
Set<number>
// code
highlightedCells: new Set<number>() as Set<number>
```

#### property: embeddingBounds

Embedding bounds for coordinate transform (normalization range)

```js
// type signature
{ minX: number; maxX: number; minY: number; maxY: number; } | null
// code
embeddingBounds: null as {
        minX: number
        maxX: number
        minY: number
        maxY: number
      } | null
```

#### property: cameraView

Camera view matrix (9-element Float32Array), synced from EmbeddingCanvas

```js
// type signature
Float32Array<ArrayBufferLike> | null
// code
cameraView: null as Float32Array | null
```

#### property: leftSidebarWidth

Left sidebar width in pixels

```js
// type signature
number
// code
leftSidebarWidth: 375
```

#### property: rightSidebarWidth

Right sidebar width in pixels

```js
// type signature
number
// code
rightSidebarWidth: 375
```

#### property: pointSize

Base point size for unselected cells in the embedding plot

```js
// type signature
number
// code
pointSize: 3.0
```

#### property: selectionMode

Selection mode across multiple columns: intersection (AND) or union (OR)

```js
// type signature
"intersection" | "union"
// code
selectionMode: 'intersection' as 'intersection' | 'union'
```

#### property: showLabels

Show category labels overlay on the embedding plot

```js
// type signature
false
// code
showLabels: false
```

#### property: categoricalPalette

Selected categorical color palette name

```js
// type signature
string
// code
categoricalPalette: DEFAULT_CATEGORICAL_PALETTE
```

#### property: continuousPalette

Selected continuous color palette name

```js
// type signature
string
// code
continuousPalette: 'viridis'
```

#### property: customCategoricalPalettes

User-defined categorical palettes: name -> array of hex colors

```js
// type signature
Record<string, string[]>
// code
customCategoricalPalettes: {} as Record<string, string[]>
```

#### property: customContinuousPalettes

User-defined continuous palettes: name -> array of hex color stops

```js
// type signature
Record<string, string[]>
// code
customContinuousPalettes: {} as Record<string, string[]>
```

#### property: featureValues

Cached expression/accessibility values per feature name.

```js
// type signature
Map<string, Float32Array<ArrayBufferLike>>
// code
featureValues: new Map<string, Float32Array>() as Map<
        string,
        Float32Array
      >
```

#### property: loadingFeatures

Feature names whose expression values are currently being fetched.

```js
// type signature
string[]
// code
loadingFeatures: [] as string[]
```

#### property: expandedFeatures

Feature names whose big histogram is currently expanded in the sidebar.

```js
// type signature
string[]
// code
expandedFeatures: [] as string[]
```

#### property: loadingGeneSets

Gene set names whose aggregate values are currently being computed.

```js
// type signature
string[]
// code
loadingGeneSets: [] as string[]
```

#### property: expandedGeneSets

Gene set names whose big histogram is currently expanded in the sidebar.

```js
// type signature
string[]
// code
expandedGeneSets: [] as string[]
```

#### property: expandedGeneSetFeatures

Gene names expanded inside each active gene set: key is
`${geneSetName}:${geneName}`.

```js
// type signature
Set<string>
// code
expandedGeneSetFeatures: new Set<string>()
```

#### property: geneSetValues

Cached aggregate expression values per gene set name.

```js
// type signature
Map<string, Float32Array<ArrayBufferLike>>
// code
geneSetValues: new Map<string, Float32Array>() as Map<
        string,
        Float32Array
      >
```

### SingleCellView - Getters

#### getter: showImportForm

```js
// type
boolean
```

#### getter: showView

```js
// type
boolean
```

#### getter: showLoading

```js
// type
boolean
```

#### getter: loadingMessage

```js
// type
'Loading single-cell dataset...' | undefined
```

#### getter: colorByName

Human-readable name of the current color-by target.

```js
// type
string | undefined
```

#### getter: colorByObsColumn

Returns the current obs-column color-by name, or undefined if color-by is a
feature.

```js
// type
string | undefined
```

#### getter: colorByFeature

Returns the current feature color-by name, or undefined if color-by is an obs
column.

```js
// type
string | undefined
```

#### getter: colorByGeneSet

Returns the current gene set color-by name, or undefined if color-by is not a
gene set.

```js
// type
string | undefined
```

### SingleCellView - Actions

#### action: setWidth

```js
// type signature
setWidth: (width: number) => void
```

#### action: setHeight

```js
// type signature
setHeight: (height: number) => void
```

#### action: setDataset

```js
// type signature
setDataset: (uri: string) => void
```

#### action: setColorBy

```js
// type signature
setColorBy: (field: string) => void
```

#### action: setError

```js
// type signature
setError: (error?: string | undefined) => void
```

#### action: setLoading

```js
// type signature
setLoading: (loading: boolean) => void
```

#### action: setSelectionTool

```js
// type signature
setSelectionTool: (tool: "rect" | "pan" | "lasso") => void
```

#### action: toggleShowLabels

```js
// type signature
toggleShowLabels: () => void
```

#### action: setCategoricalPalette

```js
// type signature
setCategoricalPalette: (palette: string) => void
```

#### action: setContinuousPalette

```js
// type signature
setContinuousPalette: (palette: string) => void
```

#### action: addCustomCategoricalPalette

```js
// type signature
addCustomCategoricalPalette: (name: string, colors: string[]) => void
```

#### action: removeCustomCategoricalPalette

```js
// type signature
removeCustomCategoricalPalette: (name: string) => void
```

#### action: addCustomContinuousPalette

```js
// type signature
addCustomContinuousPalette: (name: string, stops: string[]) => void
```

#### action: removeCustomContinuousPalette

```js
// type signature
removeCustomContinuousPalette: (name: string) => void
```

#### action: setSelectedFeature

Set the currently selected feature in the right sidebar histogram.

```js
// type signature
setSelectedFeature: (name: string) => void
```

#### action: setFeatureValues

Replace the cached feature values map.

```js
// type signature
setFeatureValues: (values: Map<string, Float32Array<ArrayBufferLike>>) => void
```

#### action: syncSelectionToSession

Sync selected cell indices to session as barcodes

```js
// type signature
syncSelectionToSession: () => void
```

#### action: setHighlightedCells

```js
// type signature
setHighlightedCells: (cells: Set<number>) => void
```

#### action: setEmbeddingBounds

```js
// type signature
setEmbeddingBounds: (minX: number, maxX: number, minY: number, maxY: number) => void
```

#### action: setCameraView

```js
// type signature
setCameraView: (view: Float32Array<ArrayBufferLike>) => void
```

#### action: setLeftSidebarWidth

```js
// type signature
setLeftSidebarWidth: (width: number) => void
```

#### action: setRightSidebarWidth

```js
// type signature
setRightSidebarWidth: (width: number) => void
```

#### action: setPointSize

```js
// type signature
setPointSize: (size: number) => void
```

#### action: recomputeSelectedCells

Recompute selectedCells from selectedLabels, labelToIndices, and selectionMode.

```js
// type signature
recomputeSelectedCells: () => void
```

#### action: setSelectionMode

```js
// type signature
setSelectionMode: (mode: "intersection" | "union") => void
```

#### action: toggleLabel

Toggle a single label in the sidebar selection.

```js
// type signature
toggleLabel: (column: string, label: string) => void
```

#### action: selectAllLabels

Select all labels for a categorical column.

```js
// type signature
selectAllLabels: (column: string) => void
```

#### action: clearColumnLabels

Clear all selected labels for a single column.

```js
// type signature
clearColumnLabels: (column: string) => void
```

#### action: setContinuousRange

```js
// type signature
setContinuousRange: (column: string, min: number, max: number) => void
```

#### action: clearContinuousRange

```js
// type signature
clearContinuousRange: (column: string) => void
```

#### action: clearSelection

Clear all sidebar selections.

```js
// type signature
clearSelection: () => void
```

#### action: applySelection

Explicitly push current selectedCells to the session for downstream BAM/CRAM
filtering. Selection no longer auto-syncs.

```js
// type signature
applySelection: () => void
```

#### action: removeFeature

Remove a feature from the active list and clear its cache/selection.

```js
// type signature
removeFeature: (name: string) => void
```

#### action: toggleFeatureExpanded

Expand or collapse the big histogram for a feature.

```js
// type signature
toggleFeatureExpanded: (name: string) => void
```

#### action: setFeatureRange

Set a selected value range for a feature.

```js
// type signature
setFeatureRange: (name: string, min: number, max: number) => void
```

#### action: clearFeatureRange

Clear the selected value range for a feature.

```js
// type signature
clearFeatureRange: (name: string) => void
```

#### action: loadDataset

Load dataset using SingleCellZarrAdapter

```js
// type signature
loadDataset: (uri: string) => Promise<void>
```

#### action: setEmbedding

Switch embedding and load the corresponding embedding data.

```js
// type signature
setEmbedding: (name: string) => Promise<void>
```

#### action: addFeature

Add a gene/peak feature to the right sidebar and load its values. The feature
appears in the list immediately with a loading indicator.

```js
// type signature
addFeature: (name: string) => Promise<void>
```

#### action: setColorByFeature

Set color-by to a feature. If the feature is not already active and addToActive
is true, it is added to the active features list.

```js
// type signature
setColorByFeature: (name: string, addToActive?: any) => Promise<void>
```

#### action: setFeatureTransform

Set the X or Y axis transform for a feature histogram.

```js
// type signature
setFeatureTransform: (name: string, axis: "x" | "y", transform: Transform) => void
```

#### action: createGeneSet

Register a new gene set in the sidebar registry. Does not activate it.

```js
// type signature
createGeneSet: (name: string, genes: string[]) => void
```

#### action: removeGeneSetFromSidebar

Remove a gene set from the sidebar (deactivate it). The registry entry is
preserved so it can be re-added later.

```js
// type signature
removeGeneSetFromSidebar: (name: string) => void
```

#### action: setGeneSetRange

Set a selected value range for a gene set.

```js
// type signature
setGeneSetRange: (name: string, min: number, max: number) => void
```

#### action: clearGeneSetRange

Clear the selected value range for a gene set.

```js
// type signature
clearGeneSetRange: (name: string) => void
```

#### action: loadGeneSetFeatures

Load each gene from a gene set into the shared featureValues cache so that the
expanded gene set view can render per-gene histograms.

```js
// type signature
loadGeneSetFeatures: (name: string) => Promise<void>
```

#### action: addGeneSet

Add a gene set to the right sidebar and compute its aggregate values.

```js
// type signature
addGeneSet: (name: string) => Promise<void>
```

#### action: toggleGeneSetExpanded

Expand or collapse the big histogram for a gene set.

```js
// type signature
toggleGeneSetExpanded: (name: string) => void
```

#### action: toggleGeneSetFeatureExpanded

Expand or collapse a single gene row inside an expanded gene set.

```js
// type signature
toggleGeneSetFeatureExpanded: (geneSetName: string, geneName: string) => void
```

#### action: removeGeneFromGeneSet

Remove a single gene from a gene set and recompute the aggregate. If the gene
set becomes empty it is removed entirely.

```js
// type signature
removeGeneFromGeneSet: (geneSetName: string, geneName: string) => Promise<void>
```

#### action: addGeneToGeneSet

Add a new gene to a gene set and recompute the aggregate expression.

```js
// type signature
addGeneToGeneSet: (geneSetName: string, geneName: string) => Promise<void>
```

#### action: setGeneSetAggregator

Change the aggregation method for a gene set and recompute its values.

```js
// type signature
setGeneSetAggregator: (geneSetName: string, aggregatorKey: string) => Promise<void>
```

#### action: setColorByGeneSet

Set color-by to a gene set and make sure it is active/loaded.

```js
// type signature
setColorByGeneSet: (name: string) => Promise<void>
```

#### action: deleteGeneSet

Permanently delete a gene set from the registry. If it is currently active in
the sidebar it is deactivated first.

```js
// type signature
deleteGeneSet: (name: string) => void
```

#### action: setGeneSetTransform

Set the X or Y axis transform for a gene set histogram.

```js
// type signature
setGeneSetTransform: (name: string, axis: "x" | "y", transform: Transform) => void
```

#### action: setObsTransform

Set the X or Y axis transform for an obs continuous column histogram.

```js
// type signature
setObsTransform: (column: string, axis: "x" | "y", transform: Transform) => void
```

#### action: afterCreate

React to genome region selections from LinearGenomeView and highlight the cells
that have reads in that region. Also restore volatile data when the view is
recreated from a persisted session snapshot.

```js
// type signature
afterCreate: () => void
```

#### action: setSelectedCells

Set selected cell indices directly (e.g. from lasso/rect selection). Does NOT
automatically sync to session; call applySelection() to push.

```js
// type signature
setSelectedCells: (cells: Set<number>) => void
```
