import { BaseViewModel } from '@jbrowse/core/pluggableElementTypes/models'
import { getConf } from '@jbrowse/core/configuration'
import { getSession, isSessionModel } from '@jbrowse/core/util'
import { flow, types, addDisposer, isAlive } from '@jbrowse/mobx-state-tree'
import { reaction } from 'mobx'

import SingleCellZarrAdapter from '../SingleCellAdapter/SingleCellZarrAdapter.ts'
import singleCellZarrAdapterConfigSchema from '../SingleCellAdapter/configSchema.ts'
import { isSessionWithSingleCellSelection } from '../SessionExtension.ts'
import { DEFAULT_CATEGORICAL_PALETTE } from './components/colorUtils.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { Region } from '@jbrowse/core/util/types'
import type {
  CategoricalColumn,
  ContinuousColumn,
  StringColumn,
} from '../SingleCellAdapter/SingleCellZarrAdapter.ts'

export type CellMetadata = Record<
  string,
  CategoricalColumn | ContinuousColumn | StringColumn
>

export interface SingleCellDataset {
  nObs: number
  nVar: number
  obsColumns: string[]
  varColumns: string[]
  embeddings: string[]
  varNames: string[]
  metadata: CellMetadata
  cellBarcodes: string[]
  embeddingData?: Float32Array
  /**
   * Precomputed map from obs column name -> label -> set of cell indices,
   * used for fast categorical selection in the sidebar.
   */
  labelToIndices: Map<string, Map<string, Set<number>>>
}

/**
 * Strategy for aggregating per-gene expression vectors into a single gene-set
 * vector. Receives one Float32Array per successfully loaded gene and must
 * return a Float32Array of length nCells.
 */
export type GeneSetAggregator = (valuesPerGene: Float32Array[]) => Float32Array

export type Transform = 'linear' | 'log'

export interface AxisTransforms {
  x: Transform
  y: Transform
}

const TransformType = types.enumeration(['linear', 'log'] as const)

const AxisTransformsModel = types.model({
  x: TransformType,
  y: TransformType,
})

const RangeModel = types.model({
  min: types.number,
  max: types.number,
})

export function applyXTransform(
  values: Float32Array,
  transform: Transform,
): Float32Array {
  if (transform === 'linear') return values
  let min = Infinity
  for (const v of values) {
    if (v < min) min = v
  }
  if (!Number.isFinite(min)) return values
  const shift = min < 0 ? -min : 0
  const out = new Float32Array(values.length)
  for (let i = 0; i < values.length; i++) {
    out[i] = Math.log1p(values[i]! + shift)
  }
  return out
}

export function applyYTransform(count: number, transform: Transform): number {
  return transform === 'linear' ? count : Math.log1p(count)
}

/**
 * Mean aggregator: for each cell, averages all finite gene values. Missing
 * genes are ignored entirely.
 */
export function meanGeneSetAggregator(
  valuesPerGene: Float32Array[],
): Float32Array {
  if (valuesPerGene.length === 0) {
    return new Float32Array(0)
  }
  const nCells = valuesPerGene[0]!.length
  const sums = new Float32Array(nCells)
  const counts = new Uint32Array(nCells)
  for (const values of valuesPerGene) {
    for (let i = 0; i < nCells; i++) {
      const v = values[i]!
      if (Number.isFinite(v)) {
        sums[i] = (sums[i] ?? 0) + v
        counts[i] = (counts[i] ?? 0) + 1
      }
    }
  }
  const result = new Float32Array(nCells)
  for (let i = 0; i < nCells; i++) {
    const count = counts[i] ?? 0
    result[i] = count > 0 ? (sums[i] ?? 0) / count : 0
  }
  return result
}

/** Default aggregator used when loading gene sets. */
const defaultGeneSetAggregator: GeneSetAggregator = meanGeneSetAggregator

/**
 * Sum aggregator: for each cell, sums all finite gene values. Missing genes
 * contribute 0.
 */
export function sumGeneSetAggregator(
  valuesPerGene: Float32Array[],
): Float32Array {
  if (valuesPerGene.length === 0) {
    return new Float32Array(0)
  }
  const nCells = valuesPerGene[0]!.length
  const result = new Float32Array(nCells)
  for (const values of valuesPerGene) {
    for (let i = 0; i < nCells; i++) {
      const v = values[i]!
      if (Number.isFinite(v)) {
        result[i] = (result[i] ?? 0) + v
      }
    }
  }
  return result
}

/**
 * Median aggregator: for each cell, takes the median of all finite gene
 * values. Robust against outlier genes.
 */
export function medianGeneSetAggregator(
  valuesPerGene: Float32Array[],
): Float32Array {
  if (valuesPerGene.length === 0) {
    return new Float32Array(0)
  }
  const nCells = valuesPerGene[0]!.length
  const result = new Float32Array(nCells)
  const cellValues = new Float32Array(valuesPerGene.length)
  for (let i = 0; i < nCells; i++) {
    let k = 0
    for (const values of valuesPerGene) {
      const v = values[i]!
      if (Number.isFinite(v)) {
        cellValues[k++] = v
      }
    }
    if (k === 0) {
      result[i] = 0
    } else {
      cellValues.subarray(0, k).sort()
      if (k % 2 === 1) {
        result[i] = cellValues[Math.floor(k / 2)]!
      } else {
        result[i] = (cellValues[k / 2 - 1]! + cellValues[k / 2]!) / 2
      }
    }
  }
  return result
}

/**
 * Max aggregator: for each cell, uses the maximum finite gene value. Useful
 * for detecting cells where any gene in the set is highly expressed.
 */
export function maxGeneSetAggregator(
  valuesPerGene: Float32Array[],
): Float32Array {
  if (valuesPerGene.length === 0) {
    return new Float32Array(0)
  }
  const nCells = valuesPerGene[0]!.length
  const result = new Float32Array(nCells)
  for (let i = 0; i < nCells; i++) {
    let max = -Infinity
    for (const values of valuesPerGene) {
      const v = values[i]!
      if (Number.isFinite(v)) {
        max = Math.max(max, v)
      }
    }
    result[i] = Number.isFinite(max) ? max : 0
  }
  return result
}

const aggregatorRegistry: Record<string, GeneSetAggregator> = {
  mean: meanGeneSetAggregator,
  sum: sumGeneSetAggregator,
  median: medianGeneSetAggregator,
  max: maxGeneSetAggregator,
}

const defaultAggregatorKey = 'mean'

export function getGeneSetAggregator(key: string): GeneSetAggregator {
  return aggregatorRegistry[key] ?? aggregatorRegistry[defaultAggregatorKey]!
}

function resolveUri(uri: string): string {
  if (typeof window === 'undefined') {
    return uri
  }
  const resolved = (() => {
    try {
      new URL(uri)
      return uri
    } catch {
      return new URL(uri, window.location.href).href
    }
  })()
  // Zarr stores are directories; a trailing slash is required so that
  // zarr.js resolves relative item paths under the store rather than
  // alongside its parent directory.
  return resolved.endsWith('/') ? resolved : `${resolved}/`
}

/**
 * #stateModel SingleCellView
 * extends
 * - [BaseViewModel](../baseviewmodel)
 */
function stateModelFactory(_pluginManager: PluginManager) {
  return types
    .compose(
      'SingleCellView',
      BaseViewModel,
      types.model({
        /**
         * #property
         */
        type: types.literal('SingleCellView'),

        /**
         * #property
         * Dataset URI (typically a Zarr directory URL)
         */
        dataset: types.maybe(types.string),

        /**
         * #property
         * Current embedding name, e.g. 'X_umap', 'X_pca'
         */
        embedding: types.maybe(types.string),

        /**
         * #property
         * Current color-by target: either an obs column, a gene/peak feature,
         * or a gene set.
         */
        colorBy: types.maybe(
          types.model({
            kind: types.enumeration(['obs', 'feature', 'geneSet']),
            name: types.string,
          }),
        ),

        /**
         * #property
         */
        error: types.maybe(types.string),

        /**
         * #property
         * Selection tool mode
         */
        selectionTool: types.optional(
          types.enumeration(['pan', 'lasso', 'rect']),
          'pan',
        ),

        /**
         * #property
         * Selected categorical labels per obs column.
         */
        selectedLabels: types.map(types.array(types.string)),

        /**
         * #property
         * Selected continuous ranges per obs column.
         */
        selectedRanges: types.map(RangeModel),

        /**
         * #property
         * X/Y axis transforms per obs continuous column.
         */
        obsTransforms: types.map(AxisTransformsModel),

        /**
         * #property
         * Active gene/peak features shown in the right sidebar.
         */
        activeFeatures: types.array(types.string),

        /**
         * #property
         * Currently selected feature in the right sidebar histogram.
         */
        selectedFeature: types.maybe(types.string),

        /**
         * #property
         * Selected value ranges per feature name.
         */
        featureRanges: types.map(RangeModel),

        /**
         * #property
         * X/Y axis transforms per feature name.
         */
        featureTransforms: types.map(AxisTransformsModel),

        /**
         * #property
         * Active gene sets shown in the right sidebar.
         */
        activeGeneSets: types.array(types.string),

        /**
         * #property
         * Currently selected gene set in the right sidebar histogram.
         */
        selectedGeneSet: types.maybe(types.string),

        /**
         * #property
         * User-defined gene sets: name -> list of gene names.
         */
        geneSets: types.map(types.array(types.string)),

        /**
         * #property
         * Selected value ranges per gene set name.
         */
        geneSetRanges: types.map(RangeModel),

        /**
         * #property
         * X/Y axis transforms per gene set name.
         */
        geneSetTransforms: types.map(AxisTransformsModel),

        /**
         * #property
         * Aggregation method key per gene set name.
         */
        geneSetAggregatorKeys: types.map(types.string),
      }),
    )
    .volatile(() => ({
      /**
       * #property
       */
      width: 800,
      /**
       * #property
       */
      height: 600,
      /**
       * #property
       */
      loading: false,
      /**
       * #property
       * Loaded dataset data (frozen to avoid MST deep observation overhead)
       */
      data: undefined as SingleCellDataset | undefined,
      /**
       * #property
       * Adapter instance used to load embeddings and metadata on demand
       */
      adapter: undefined as SingleCellZarrAdapter | undefined,
      /**
       * #property
       * Selected cell indices
       */
      selectedCells: new Set<number>() as Set<number>,
      /**
       * #property
       * Highlighted cell indices (hover)
       */
      highlightedCells: new Set<number>() as Set<number>,
      /**
       * #property
       * Embedding bounds for coordinate transform (normalization range)
       */
      embeddingBounds: null as {
        minX: number
        maxX: number
        minY: number
        maxY: number
      } | null,
      /**
       * #property
       * Camera view matrix (9-element Float32Array), synced from EmbeddingCanvas
       */
      cameraView: null as Float32Array | null,
      /**
       * #property
       * Left sidebar width in pixels
       */
      leftSidebarWidth: 375,
      /**
       * #property
       * Right sidebar width in pixels
       */
      rightSidebarWidth: 375,
      /**
       * #property
       * Base point size for unselected cells in the embedding plot
       */
      pointSize: 3.0,
      /**
       * #property
       * Selection mode across multiple columns: intersection (AND) or union (OR)
       */
      selectionMode: 'intersection' as 'intersection' | 'union',
      /**
       * #property
       * Show category labels overlay on the embedding plot
       */
      showLabels: false,
      /**
       * #property
       * Selected categorical color palette name
       */
      categoricalPalette: DEFAULT_CATEGORICAL_PALETTE,
      /**
       * #property
       * Selected continuous color palette name
       */
      continuousPalette: 'viridis',
      /**
       * #property
       * User-defined categorical palettes: name -> array of hex colors
       */
      customCategoricalPalettes: {} as Record<string, string[]>,
      /**
       * #property
       * User-defined continuous palettes: name -> array of hex color stops
       */
      customContinuousPalettes: {} as Record<string, string[]>,
      /**
       * #property
       * Cached expression/accessibility values per feature name.
       */
      featureValues: new Map<string, Float32Array>() as Map<
        string,
        Float32Array
      >,
      /**
       * #property
       * Feature names whose expression values are currently being fetched.
       */
      loadingFeatures: [] as string[],
      /**
       * #property
       * Feature names whose big histogram is currently expanded in the sidebar.
       */
      expandedFeatures: [] as string[],
      /**
       * #property
       * Gene set names whose aggregate values are currently being computed.
       */
      loadingGeneSets: [] as string[],
      /**
       * #property
       * Gene set names whose big histogram is currently expanded in the sidebar.
       */
      expandedGeneSets: [] as string[],
      /**
       * #property
       * Gene names expanded inside each active gene set: key is
       * `${geneSetName}:${geneName}`.
       */
      expandedGeneSetFeatures: new Set<string>(),
      /**
       * #property
       * Cached aggregate expression values per gene set name.
       */
      geneSetValues: new Map<string, Float32Array>() as Map<
        string,
        Float32Array
      >,
    }))
    .views(self => ({
      /**
       * #getter
       */
      get showImportForm() {
        return !self.dataset
      },
      /**
       * #getter
       */
      get showView() {
        return !!self.dataset && !!self.data
      },
      /**
       * #getter
       */
      get showLoading() {
        return self.loading
      },
      /**
       * #getter
       */
      get loadingMessage() {
        return self.loading ? 'Loading single-cell dataset...' : undefined
      },
      /**
       * #getter
       * Human-readable name of the current color-by target.
       */
      get colorByName() {
        return self.colorBy?.name
      },
      /**
       * #getter
       * Returns the current obs-column color-by name, or undefined if color-by
       * is a feature.
       */
      get colorByObsColumn() {
        return self.colorBy?.kind === 'obs' ? self.colorBy.name : undefined
      },
      /**
       * #getter
       * Returns the current feature color-by name, or undefined if color-by is
       * an obs column.
       */
      get colorByFeature() {
        return self.colorBy?.kind === 'feature' ? self.colorBy.name : undefined
      },
      /**
       * #getter
       * Returns the current gene set color-by name, or undefined if color-by is
       * not a gene set.
       */
      get colorByGeneSet() {
        return self.colorBy?.kind === 'geneSet' ? self.colorBy.name : undefined
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      setWidth(width: number) {
        self.width = width
      },
      /**
       * #action
       */
      setHeight(height: number) {
        self.height = height
      },
      /**
       * #action
       */
      setDataset(uri: string) {
        self.dataset = uri
      },
      /**
       * #action
       */
      setColorBy(field: string) {
        self.colorBy = { kind: 'obs', name: field }
      },
      /**
       * #action
       */
      setError(error?: string) {
        self.error = error
      },
      /**
       * #action
       */
      setLoading(loading: boolean) {
        self.loading = loading
      },
      /**
       * #action
       */
      setSelectionTool(tool: 'pan' | 'lasso' | 'rect') {
        self.selectionTool = tool
      },
      /**
       * #action
       */
      toggleShowLabels() {
        self.showLabels = !self.showLabels
      },
      /**
       * #action
       */
      setCategoricalPalette(palette: string) {
        self.categoricalPalette = palette
      },
      /**
       * #action
       */
      setContinuousPalette(palette: string) {
        self.continuousPalette = palette
      },
      /**
       * #action
       */
      addCustomCategoricalPalette(name: string, colors: string[]) {
        self.customCategoricalPalettes = {
          ...self.customCategoricalPalettes,
          [name]: colors,
        }
      },
      /**
       * #action
       */
      removeCustomCategoricalPalette(name: string) {
        const next = { ...self.customCategoricalPalettes }
        delete next[name]
        self.customCategoricalPalettes = next
        if (self.categoricalPalette === name) {
          self.categoricalPalette = DEFAULT_CATEGORICAL_PALETTE
        }
      },
      /**
       * #action
       */
      addCustomContinuousPalette(name: string, stops: string[]) {
        self.customContinuousPalettes = {
          ...self.customContinuousPalettes,
          [name]: stops,
        }
      },
      /**
       * #action
       */
      removeCustomContinuousPalette(name: string) {
        const next = { ...self.customContinuousPalettes }
        delete next[name]
        self.customContinuousPalettes = next
        if (self.continuousPalette === name) {
          self.continuousPalette = 'viridis'
        }
      },
      /**
       * #action
       * Set the currently selected feature in the right sidebar histogram.
       */
      setSelectedFeature(name: string) {
        self.selectedFeature = name
      },
      /**
       * #action
       * Replace the cached feature values map.
       */
      setFeatureValues(values: Map<string, Float32Array>) {
        self.featureValues = values
      },
      /**
       * #action
       * Sync selected cell indices to session as barcodes
       */
      syncSelectionToSession() {
        if (!isAlive(self)) return
        const session = getSession(self)
        if (
          isSessionModel(session) &&
          isSessionWithSingleCellSelection(session)
        ) {
          const barcodes = new Set<string>()
          const data = self.data
          if (data?.cellBarcodes.length) {
            for (const idx of self.selectedCells as Set<number>) {
              const barcode = data.cellBarcodes[idx as number]
              if (barcode) {
                barcodes.add(barcode)
              }
            }
          }
          session.singleCellSelection.setSelectedCells(barcodes)
          session.singleCellSelection.setActiveSingleCellViewId(self.id)
        }
      },
      /**
       * #action
       */
      setHighlightedCells(cells: Set<number>) {
        self.highlightedCells = cells
      },
      /**
       * #action
       */
      setEmbeddingBounds(
        minX: number,
        maxX: number,
        minY: number,
        maxY: number,
      ) {
        self.embeddingBounds = { minX, maxX, minY, maxY }
      },
      /**
       * #action
       */
      setCameraView(view: Float32Array) {
        self.cameraView = view
      },
      /**
       * #action
       */
      setLeftSidebarWidth(width: number) {
        self.leftSidebarWidth = width
      },
      /**
       * #action
       */
      setRightSidebarWidth(width: number) {
        self.rightSidebarWidth = width
      },
      /**
       * #action
       */
      setPointSize(size: number) {
        self.pointSize = size
      },
    }))
    .actions(self => ({
      /**
       * #action
       * Recompute selectedCells from selectedLabels, labelToIndices, and selectionMode.
       */
      recomputeSelectedCells() {
        const data = self.data
        if (!data) {
          self.selectedCells = new Set()
          return
        }

        const candidateSets: Set<number>[] = []

        // Categorical selections
        for (const [column, labels] of self.selectedLabels.entries()) {
          if (labels.length === 0) continue
          const colMap = data.labelToIndices.get(column)
          if (!colMap) continue
          const union = new Set<number>()
          for (const label of labels) {
            const indices = colMap.get(label)
            if (indices) {
              for (const idx of indices) {
                union.add(idx)
              }
            }
          }
          candidateSets.push(union)
        }

        // Continuous range selections
        for (const [column, range] of self.selectedRanges.entries()) {
          const col = data.metadata[column]
          if (col?.type !== 'continuous') continue
          const set = new Set<number>()
          const { values } = col
          const transform = self.obsTransforms.get(column)?.x ?? 'linear'
          const transformed = applyXTransform(values, transform)
          const { min, max } = range
          for (let i = 0; i < transformed.length; i++) {
            const v = transformed[i]!
            if (v >= min && v <= max) {
              set.add(i)
            }
          }
          candidateSets.push(set)
        }

        // Feature range selections
        for (const [name, range] of self.featureRanges.entries()) {
          const values = self.featureValues.get(name)
          if (!values) continue
          const transform = self.featureTransforms.get(name)?.x ?? 'linear'
          const transformed = applyXTransform(values, transform)
          const set = new Set<number>()
          const { min, max } = range
          for (let i = 0; i < transformed.length; i++) {
            const v = transformed[i]!
            if (v >= min && v <= max) {
              set.add(i)
            }
          }
          candidateSets.push(set)
        }

        // Gene set range selections
        for (const [name, range] of self.geneSetRanges.entries()) {
          const values = self.geneSetValues.get(name)
          if (!values) continue
          const transform = self.geneSetTransforms.get(name)?.x ?? 'linear'
          const transformed = applyXTransform(values, transform)
          const set = new Set<number>()
          const { min, max } = range
          for (let i = 0; i < transformed.length; i++) {
            const v = transformed[i]!
            if (v >= min && v <= max) {
              set.add(i)
            }
          }
          candidateSets.push(set)
        }

        if (candidateSets.length === 0) {
          self.selectedCells = new Set()
          return
        }

        if (self.selectionMode === 'union') {
          const result = new Set<number>()
          for (const set of candidateSets) {
            for (const idx of set) {
              result.add(idx)
            }
          }
          self.selectedCells = result
        } else {
          const first = candidateSets[0]!
          const rest = candidateSets.slice(1)
          const result = new Set<number>()
          for (const idx of first) {
            let inAll = true
            for (const set of rest) {
              if (!set.has(idx)) {
                inAll = false
                break
              }
            }
            if (inAll) {
              result.add(idx)
            }
          }
          self.selectedCells = result
        }
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      setSelectionMode(mode: 'intersection' | 'union') {
        self.selectionMode = mode
        self.recomputeSelectedCells()
      },
      /**
       * #action
       * Toggle a single label in the sidebar selection.
       */
      toggleLabel(column: string, label: string) {
        const labels = Array.from(self.selectedLabels.get(column) ?? [])
        const newLabels = new Set(labels)
        if (newLabels.has(label)) {
          newLabels.delete(label)
        } else {
          newLabels.add(label)
        }
        if (newLabels.size === 0) {
          self.selectedLabels.delete(column)
        } else {
          self.selectedLabels.set(column, Array.from(newLabels))
        }
        self.recomputeSelectedCells()
      },
      /**
       * #action
       * Select all labels for a categorical column.
       */
      selectAllLabels(column: string) {
        const data = self.data
        if (!data?.labelToIndices) return
        const colMap = data.labelToIndices.get(column)
        if (!colMap) return
        self.selectedLabels.set(column, Array.from(colMap.keys()))
        self.recomputeSelectedCells()
      },
      /**
       * #action
       * Clear all selected labels for a single column.
       */
      clearColumnLabels(column: string) {
        self.selectedLabels.delete(column)
        self.recomputeSelectedCells()
      },
      /**
       * #action
       */
      setContinuousRange(column: string, min: number, max: number) {
        self.selectedRanges.set(column, { min, max })
        self.recomputeSelectedCells()
      },
      /**
       * #action
       */
      clearContinuousRange(column: string) {
        self.selectedRanges.delete(column)
        self.recomputeSelectedCells()
      },
      /**
       * #action
       * Clear all sidebar selections.
       */
      clearSelection() {
        self.selectedLabels.clear()
        self.selectedRanges.clear()
        self.selectedCells = new Set()
      },
      /**
       * #action
       * Explicitly push current selectedCells to the session for downstream
       * BAM/CRAM filtering. Selection no longer auto-syncs.
       */
      applySelection() {
        self.syncSelectionToSession()
      },
      /**
       * #action
       * Remove a feature from the active list and clear its cache/selection.
       */
      removeFeature(name: string) {
        self.activeFeatures.replace(self.activeFeatures.filter(n => n !== name))
        self.loadingFeatures = self.loadingFeatures.filter(n => n !== name)
        self.expandedFeatures = self.expandedFeatures.filter(n => n !== name)
        if (self.selectedFeature === name) {
          self.selectedFeature = undefined
        }
        if (self.colorBy?.kind === 'feature' && self.colorBy.name === name) {
          self.colorBy = undefined
        }
        const nextValues = new Map(self.featureValues)
        nextValues.delete(name)
        self.featureValues = nextValues
        self.featureRanges.delete(name)
        self.recomputeSelectedCells()
      },
      /**
       * #action
       * Expand or collapse the big histogram for a feature.
       */
      toggleFeatureExpanded(name: string) {
        if (self.expandedFeatures.includes(name)) {
          self.expandedFeatures = self.expandedFeatures.filter(n => n !== name)
        } else {
          self.expandedFeatures = [...self.expandedFeatures, name]
        }
      },
      /**
       * #action
       * Set a selected value range for a feature.
       */
      setFeatureRange(name: string, min: number, max: number) {
        self.featureRanges.set(name, { min, max })
        self.recomputeSelectedCells()
      },
      /**
       * #action
       * Clear the selected value range for a feature.
       */
      clearFeatureRange(name: string) {
        self.featureRanges.delete(name)
        self.recomputeSelectedCells()
      },
      /**
       * #action
       * Load dataset using SingleCellZarrAdapter
       */
      loadDataset: flow(function* (uri: string) {
        self.loading = true
        self.error = undefined
        try {
          const resolvedUri = resolveUri(uri)
          const adapter = new SingleCellZarrAdapter(
            singleCellZarrAdapterConfigSchema.create({
              zarrLocation: { uri: resolvedUri },
            }),
          )

          yield adapter.init()

          // Choose embedding: prefer the currently selected one if it still
          // exists in the dataset, otherwise fall back to X_umap or the first
          // available embedding.
          const embeddings = adapter.embeddings
          const defaultEmbedding = embeddings.includes('X_umap')
            ? 'X_umap'
            : embeddings[0]
          const targetEmbedding =
            self.embedding && embeddings.includes(self.embedding)
              ? self.embedding
              : defaultEmbedding

          let embeddingData: Float32Array | undefined
          if (targetEmbedding) {
            embeddingData = yield adapter.getEmbedding(targetEmbedding)
          }

          // Load cell barcodes from obs index column
          const obsIndexColumn = adapter.getConf('obsIndexColumn') as string
          let cellBarcodes: string[] = []
          try {
            const indexCol = yield adapter.getObsColumn(obsIndexColumn)
            if (indexCol.type === 'categorical') {
              cellBarcodes = Array.from(
                indexCol.codes as ArrayLike<number>,
              ).map(code => indexCol.categories[code] ?? '')
            } else if (indexCol.type === 'string') {
              cellBarcodes = indexCol.values
            } else {
              cellBarcodes = Array.from(indexCol.values as unknown as string[])
            }
          } catch {
            // fallback to numeric indices
            cellBarcodes = Array.from({ length: adapter.nObs }, (_, i) =>
              String(i),
            )
          }

          // Load metadata columns. Prioritize common color-by candidates first,
          // then load every remaining obs column so the sidebar is complete.
          const metadata: CellMetadata = {}
          const colorByCandidates = [
            'cell_type',
            'leiden',
            'louvain',
            'cluster',
          ]
          const prioritized = [
            ...colorByCandidates.filter(c => adapter.obsColumns.includes(c)),
            ...adapter.obsColumns.filter(c => c !== obsIndexColumn),
          ]
          const columnsToLoad = Array.from(new Set(prioritized))
          for (const col of columnsToLoad) {
            try {
              metadata[col] = yield adapter.getObsColumn(col)
            } catch {
              // skip columns that fail to load
            }
          }

          // Preserve the existing colorBy when reloading (e.g. on session
          // restore); only clear it during the initial load from the import form.
          const existingColorBy = self.colorBy

          // Precompute label -> cell indices map for fast categorical selection
          const labelToIndices = new Map<string, Map<string, Set<number>>>()
          for (const [colName, col] of Object.entries(metadata)) {
            if (col.type === 'categorical') {
              const map = new Map<string, Set<number>>()
              for (const cat of col.categories) {
                map.set(cat, new Set())
              }
              for (let i = 0; i < col.codes.length; i++) {
                const label = col.categories[col.codes[i]!]
                if (label !== undefined) {
                  map.get(label)?.add(i)
                }
              }
              labelToIndices.set(colName, map)
            }
          }

          self.data = {
            nObs: adapter.nObs,
            nVar: adapter.nVar,
            obsColumns: adapter.obsColumns,
            varColumns: adapter.varColumns,
            embeddings: adapter.embeddings,
            varNames: adapter.varNames,
            metadata,
            cellBarcodes,
            embeddingData,
            labelToIndices,
          }
          self.adapter = adapter
          self.dataset = resolvedUri
          self.embedding = targetEmbedding
          self.colorBy = existingColorBy

          // After a session restore the persisted selection/feature/gene-set
          // state may reference items that no longer exist. Prune invalid
          // entries and reload cached values for the survivors.
          const varNameSet = new Set(adapter.varNames)
          const obsColumnSet = new Set(adapter.obsColumns)

          // Categorical/continuous obs selections
          for (const [column] of self.selectedLabels) {
            const col = metadata[column]
            if (!col || col.type !== 'categorical') {
              self.selectedLabels.delete(column)
            }
          }
          for (const [column] of self.selectedRanges) {
            const col = metadata[column]
            if (!col || col.type !== 'continuous') {
              self.selectedRanges.delete(column)
            }
          }
          for (const [column] of self.obsTransforms) {
            const col = metadata[column]
            if (!col || col.type !== 'continuous') {
              self.obsTransforms.delete(column)
            }
          }

          // Features
          self.activeFeatures.replace(
            self.activeFeatures.filter(name => varNameSet.has(name)),
          )
          if (
            self.selectedFeature &&
            !self.activeFeatures.includes(self.selectedFeature)
          ) {
            self.selectedFeature = undefined
          }
          for (const [name] of self.featureRanges) {
            if (!self.activeFeatures.includes(name)) {
              self.featureRanges.delete(name)
            }
          }
          for (const [name] of self.featureTransforms) {
            if (!self.activeFeatures.includes(name)) {
              self.featureTransforms.delete(name)
            }
          }

          // Gene sets
          const validGeneSets = new Set(self.geneSets.keys())
          self.activeGeneSets.replace(
            self.activeGeneSets.filter(name => validGeneSets.has(name)),
          )
          if (
            self.selectedGeneSet &&
            !self.activeGeneSets.includes(self.selectedGeneSet)
          ) {
            self.selectedGeneSet = undefined
          }
          for (const [name] of self.geneSetRanges) {
            if (!self.activeGeneSets.includes(name)) {
              self.geneSetRanges.delete(name)
            }
          }
          for (const [name] of self.geneSetTransforms) {
            if (!self.activeGeneSets.includes(name)) {
              self.geneSetTransforms.delete(name)
            }
          }
          for (const [name] of self.geneSetAggregatorKeys) {
            if (!self.activeGeneSets.includes(name)) {
              self.geneSetAggregatorKeys.delete(name)
            }
          }

          // colorBy
          if (self.colorBy) {
            const { kind, name } = self.colorBy
            const valid =
              (kind === 'obs' && obsColumnSet.has(name)) ||
              (kind === 'feature' && varNameSet.has(name)) ||
              (kind === 'geneSet' && validGeneSets.has(name))
            if (!valid) {
              self.colorBy = undefined
            }
          }

          // Reload cached values for restored active items. Build new Maps and
          // replace the volatile state so mobx observes the update.
          const nextFeatureValues = new Map(self.featureValues)
          for (const name of self.activeFeatures) {
            try {
              const values = yield adapter.getExpression(name)
              nextFeatureValues.set(name, values)
            } catch {
              // Ignore missing features.
            }
          }

          const nextGeneSetValues = new Map(self.geneSetValues)
          for (const name of self.activeGeneSets) {
            const genes = self.geneSets.get(name)
            if (!genes || genes.length === 0) continue
            const valuesPerGene: Float32Array[] = []
            for (const gene of genes) {
              let values = nextFeatureValues.get(gene)
              if (!values) {
                try {
                  values = yield adapter.getExpression(gene)
                  if (values) {
                    nextFeatureValues.set(gene, values)
                  }
                } catch {
                  continue
                }
              }
              if (values) {
                valuesPerGene.push(values)
              }
            }
            if (valuesPerGene.length > 0) {
              const aggregatorKey =
                self.geneSetAggregatorKeys.get(name) ?? defaultAggregatorKey
              const aggregated =
                getGeneSetAggregator(aggregatorKey)(valuesPerGene)
              nextGeneSetValues.set(name, aggregated)
            }
          }

          self.featureValues = nextFeatureValues
          self.geneSetValues = nextGeneSetValues

          self.recomputeSelectedCells()
        } catch (e) {
          self.error = e instanceof Error ? e.message : String(e)
          self.dataset = undefined
        } finally {
          self.loading = false
        }
      }),
    }))
    .actions(self => ({
      /**
       * #action
       * Switch embedding and load the corresponding embedding data.
       */
      setEmbedding: flow(function* (name: string) {
        self.embedding = name
        const adapter = self.adapter
        const data = self.data
        if (!adapter || !data) return
        try {
          const embeddingData = yield adapter.getEmbedding(name)
          self.data = { ...data, embeddingData }
        } catch (e) {
          self.error = e instanceof Error ? e.message : String(e)
        }
      }),
    }))
    .actions(self => ({
      /**
       * #action
       * Add a gene/peak feature to the right sidebar and load its values.
       * The feature appears in the list immediately with a loading indicator.
       */
      addFeature: flow(function* (name: string) {
        if (
          self.activeFeatures.includes(name) ||
          self.loadingFeatures.includes(name)
        ) {
          return
        }
        const adapter = self.adapter
        if (!adapter) return

        self.activeFeatures.push(name)
        self.loadingFeatures = [...self.loadingFeatures, name]

        try {
          const values = yield adapter.getExpression(name)
          const nextValues = new Map(self.featureValues)
          nextValues.set(name, values)
          self.featureValues = nextValues
          if (!self.selectedFeature) {
            self.selectedFeature = name
          }
        } catch (e) {
          self.error = e instanceof Error ? e.message : String(e)
          // Remove the feature from the active list if loading failed.
          self.activeFeatures.replace(
            self.activeFeatures.filter(n => n !== name),
          )
        } finally {
          self.loadingFeatures = self.loadingFeatures.filter(n => n !== name)
        }
      }),
    }))
    .actions(self => ({
      /**
       * #action
       * Set color-by to a feature. If the feature is not already active and
       * addToActive is true, it is added to the active features list.
       */
      setColorByFeature: flow(function* (name: string, addToActive = true) {
        if (!self.activeFeatures.includes(name)) {
          if (addToActive) {
            yield self.addFeature(name)
          } else {
            const adapter = self.adapter
            if (adapter) {
              try {
                const values = yield adapter.getExpression(name)
                const nextValues = new Map(self.featureValues)
                nextValues.set(name, values)
                self.featureValues = nextValues
              } catch {
                // Ignore missing genes; color-by will fall back to gray.
              }
            }
          }
        }
        self.selectedFeature = name
        self.colorBy = { kind: 'feature', name }
      }),
      /**
       * #action
       * Set the X or Y axis transform for a feature histogram.
       */
      setFeatureTransform(name: string, axis: 'x' | 'y', transform: Transform) {
        const current = self.featureTransforms.get(name) ?? {
          x: 'linear',
          y: 'linear',
        }
        self.featureTransforms.set(name, { ...current, [axis]: transform })
        if (axis === 'x') {
          self.clearFeatureRange(name)
          self.recomputeSelectedCells()
        }
      },
    }))
    .actions(self => ({
      /**
       * #action
       * Register a new gene set in the sidebar registry. Does not activate it.
       */
      createGeneSet(name: string, genes: string[]) {
        self.geneSets.set(name, genes)
      },
      /**
       * #action
       * Remove a gene set from the sidebar (deactivate it). The registry entry
       * is preserved so it can be re-added later.
       */
      removeGeneSetFromSidebar(name: string) {
        self.activeGeneSets.replace(self.activeGeneSets.filter(n => n !== name))
        self.loadingGeneSets = self.loadingGeneSets.filter(n => n !== name)
        self.expandedGeneSets = self.expandedGeneSets.filter(n => n !== name)
        const prefix = `${name}:`
        const nextExpandedFeatures = new Set<string>()
        for (const key of self.expandedGeneSetFeatures) {
          if (!key.startsWith(prefix)) {
            nextExpandedFeatures.add(key)
          }
        }
        self.expandedGeneSetFeatures = nextExpandedFeatures
        if (self.selectedGeneSet === name) {
          self.selectedGeneSet = undefined
        }
        if (self.colorBy?.kind === 'geneSet' && self.colorBy.name === name) {
          self.colorBy = undefined
        }
        const nextValues = new Map(self.geneSetValues)
        nextValues.delete(name)
        self.geneSetValues = nextValues
        self.geneSetRanges.delete(name)
        self.geneSetAggregatorKeys.delete(name)
        self.recomputeSelectedCells()
      },
      /**
       * #action
       * Set a selected value range for a gene set.
       */
      setGeneSetRange(name: string, min: number, max: number) {
        self.geneSetRanges.set(name, { min, max })
        self.recomputeSelectedCells()
      },
      /**
       * #action
       * Clear the selected value range for a gene set.
       */
      clearGeneSetRange(name: string) {
        self.geneSetRanges.delete(name)
        self.recomputeSelectedCells()
      },
      /**
       * #action
       * Load each gene from a gene set into the shared featureValues cache so
       * that the expanded gene set view can render per-gene histograms.
       */
      loadGeneSetFeatures: flow(function* (name: string) {
        const genes = self.geneSets.get(name)
        if (!genes || genes.length === 0) return
        const adapter = self.adapter
        if (!adapter) return

        const nextValues = new Map(self.featureValues)
        let changed = false
        for (const gene of genes) {
          if (nextValues.has(gene)) continue
          try {
            const values = yield adapter.getExpression(gene)
            nextValues.set(gene, values)
            changed = true
          } catch {
            // Skip genes that are not present in the dataset.
          }
        }
        if (changed) {
          self.featureValues = nextValues
        }
      }),
      /**
       * #action
       * Add a gene set to the right sidebar and compute its aggregate values.
       */
      addGeneSet: flow(function* (name: string) {
        if (
          self.activeGeneSets.includes(name) ||
          self.loadingGeneSets.includes(name)
        ) {
          return
        }
        const genes = self.geneSets.get(name)
        if (!genes || genes.length === 0) return
        const adapter = self.adapter
        if (!adapter) return

        self.activeGeneSets.push(name)
        self.loadingGeneSets = [...self.loadingGeneSets, name]

        try {
          const valuesPerGene: Float32Array[] = []
          for (const gene of genes) {
            try {
              const values = yield adapter.getExpression(gene)
              valuesPerGene.push(values)
            } catch {
              // Skip genes that are not present in the dataset.
            }
          }
          if (valuesPerGene.length === 0) {
            throw new Error(
              `No genes from set "${name}" could be loaded from this dataset.`,
            )
          }
          const aggregatorKey =
            self.geneSetAggregatorKeys.get(name) ?? defaultAggregatorKey
          const aggregated = getGeneSetAggregator(aggregatorKey)(valuesPerGene)
          const nextValues = new Map(self.geneSetValues)
          nextValues.set(name, aggregated)
          self.geneSetValues = nextValues
          if (!self.selectedGeneSet) {
            self.selectedGeneSet = name
          }
        } catch (e) {
          self.error = e instanceof Error ? e.message : String(e)
          self.activeGeneSets.replace(
            self.activeGeneSets.filter(n => n !== name),
          )
        } finally {
          self.loadingGeneSets = self.loadingGeneSets.filter(n => n !== name)
        }
      }),
    }))
    .actions(self => ({
      /**
       * #action
       * Expand or collapse the big histogram for a gene set.
       */
      toggleGeneSetExpanded(name: string) {
        if (self.expandedGeneSets.includes(name)) {
          self.expandedGeneSets = self.expandedGeneSets.filter(n => n !== name)
        } else {
          self.expandedGeneSets = [...self.expandedGeneSets, name]
          void self.loadGeneSetFeatures(name)
        }
      },
      /**
       * #action
       * Expand or collapse a single gene row inside an expanded gene set.
       */
      toggleGeneSetFeatureExpanded(geneSetName: string, geneName: string) {
        const key = `${geneSetName}:${geneName}`
        const next = new Set(self.expandedGeneSetFeatures)
        if (next.has(key)) {
          next.delete(key)
        } else {
          next.add(key)
        }
        self.expandedGeneSetFeatures = next
      },
      /**
       * #action
       * Remove a single gene from a gene set and recompute the aggregate.
       * If the gene set becomes empty it is removed entirely.
       */
      removeGeneFromGeneSet: flow(function* (
        geneSetName: string,
        geneName: string,
      ) {
        const genes = self.geneSets.get(geneSetName)
        if (!genes) return
        const nextGenes = genes.filter(g => g !== geneName)
        if (nextGenes.length === 0) {
          self.removeGeneSetFromSidebar(geneSetName)
          self.geneSets.delete(geneSetName)
          return
        }
        self.geneSets.set(geneSetName, nextGenes)

        const key = `${geneSetName}:${geneName}`
        const nextExpanded = new Set(self.expandedGeneSetFeatures)
        nextExpanded.delete(key)
        self.expandedGeneSetFeatures = nextExpanded

        const adapter = self.adapter
        if (adapter) {
          const valuesPerGene: Float32Array[] = []
          for (const gene of nextGenes) {
            let values = self.featureValues.get(gene)
            if (!values) {
              try {
                const fetched = yield adapter.getExpression(gene)
                values = fetched
                const nextFeatureValues = new Map(self.featureValues)
                nextFeatureValues.set(gene, fetched)
                self.featureValues = nextFeatureValues
              } catch {
                continue
              }
            }
            if (values) {
              valuesPerGene.push(values)
            }
          }
          if (valuesPerGene.length > 0) {
            const aggregatorKey =
              self.geneSetAggregatorKeys.get(geneSetName) ??
              defaultAggregatorKey
            const aggregated =
              getGeneSetAggregator(aggregatorKey)(valuesPerGene)
            const nextValues = new Map(self.geneSetValues)
            nextValues.set(geneSetName, aggregated)
            self.geneSetValues = nextValues
          }
        }
        self.recomputeSelectedCells()
      }),
      /**
       * #action
       * Add a new gene to a gene set and recompute the aggregate expression.
       */
      addGeneToGeneSet: flow(function* (geneSetName: string, geneName: string) {
        const genes = self.geneSets.get(geneSetName)
        if (!genes || genes.includes(geneName)) return
        const nextGenes = [...genes, geneName]
        self.geneSets.set(geneSetName, nextGenes)

        const adapter = self.adapter
        if (!adapter) return

        let values = self.featureValues.get(geneName)
        if (!values) {
          try {
            const fetched = yield adapter.getExpression(geneName)
            values = fetched
            const nextFeatureValues = new Map(self.featureValues)
            nextFeatureValues.set(geneName, fetched)
            self.featureValues = nextFeatureValues
          } catch {
            // Keep the gene in the set even if expression data is missing.
          }
        }

        const valuesPerGene: Float32Array[] = []
        for (const gene of nextGenes) {
          const v = self.featureValues.get(gene)
          if (v) {
            valuesPerGene.push(v)
          }
        }
        if (valuesPerGene.length > 0) {
          const aggregatorKey =
            self.geneSetAggregatorKeys.get(geneSetName) ?? defaultAggregatorKey
          const aggregated = getGeneSetAggregator(aggregatorKey)(valuesPerGene)
          const nextValues = new Map(self.geneSetValues)
          nextValues.set(geneSetName, aggregated)
          self.geneSetValues = nextValues
        }
        self.recomputeSelectedCells()
      }),
      /**
       * #action
       * Change the aggregation method for a gene set and recompute its values.
       */
      setGeneSetAggregator: flow(function* (
        geneSetName: string,
        aggregatorKey: string,
      ) {
        if (!aggregatorRegistry[aggregatorKey]) return
        self.geneSetAggregatorKeys.set(geneSetName, aggregatorKey)

        const genes = self.geneSets.get(geneSetName)
        if (!genes || genes.length === 0) return
        const adapter = self.adapter
        if (!adapter) return

        const valuesPerGene: Float32Array[] = []
        for (const gene of genes) {
          let values = self.featureValues.get(gene)
          if (!values) {
            try {
              const fetched = yield adapter.getExpression(gene)
              values = fetched
              const nextFeatureValues = new Map(self.featureValues)
              nextFeatureValues.set(gene, fetched)
              self.featureValues = nextFeatureValues
            } catch {
              continue
            }
          }
          if (values) {
            valuesPerGene.push(values)
          }
        }
        if (valuesPerGene.length > 0) {
          const aggregated = getGeneSetAggregator(aggregatorKey)(valuesPerGene)
          const nextValues = new Map(self.geneSetValues)
          nextValues.set(geneSetName, aggregated)
          self.geneSetValues = nextValues
        }
        self.clearGeneSetRange(geneSetName)
        self.recomputeSelectedCells()
      }),
    }))
    .actions(self => ({
      /**
       * #action
       * Set color-by to a gene set and make sure it is active/loaded.
       */
      setColorByGeneSet: flow(function* (name: string) {
        if (!self.activeGeneSets.includes(name)) {
          yield self.addGeneSet(name)
        }
        self.selectedGeneSet = name
        self.colorBy = { kind: 'geneSet', name }
      }),
      /**
       * #action
       * Permanently delete a gene set from the registry. If it is currently
       * active in the sidebar it is deactivated first.
       */
      deleteGeneSet(name: string) {
        self.removeGeneSetFromSidebar(name)
        self.geneSets.delete(name)
      },
      /**
       * #action
       * Set the X or Y axis transform for a gene set histogram.
       */
      setGeneSetTransform(name: string, axis: 'x' | 'y', transform: Transform) {
        const current = self.geneSetTransforms.get(name) ?? {
          x: 'linear',
          y: 'linear',
        }
        self.geneSetTransforms.set(name, { ...current, [axis]: transform })
        if (axis === 'x') {
          self.clearGeneSetRange(name)
          self.recomputeSelectedCells()
        }
      },
      /**
       * #action
       * Set the X or Y axis transform for an obs continuous column histogram.
       */
      setObsTransform(column: string, axis: 'x' | 'y', transform: Transform) {
        const current = self.obsTransforms.get(column) ?? {
          x: 'linear',
          y: 'linear',
        }
        self.obsTransforms.set(column, { ...current, [axis]: transform })
        if (axis === 'x') {
          self.clearContinuousRange(column)
          self.recomputeSelectedCells()
        }
      },
    }))
    .actions(self => ({
      /**
       * #action
       * React to genome region selections from LinearGenomeView and highlight
       * the cells that have reads in that region. Also restore volatile data
       * when the view is recreated from a persisted session snapshot.
       */
      afterCreate() {
        // Session snapshots only persist `dataset`; volatile `data` must be
        // reloaded when the model is recreated (e.g. page reload).
        if (self.dataset && !self.data) {
          self.loadDataset(self.dataset)
        }

        addDisposer(
          self,
          reaction(
            () => {
              if (!isAlive(self)) return undefined
              const session = getSession(self)
              return isSessionWithSingleCellSelection(session)
                ? session.singleCellSelection.selectedRegion
                : undefined
            },
            async region => {
              if (!isAlive(self)) return
              if (!region) {
                self.setHighlightedCells(new Set())
                return
              }
              if (!isAlive(self)) return
              const session = getSession(self)
              const barcodes = new Set<string>()
              try {
                for (const view of session.views) {
                  if (!('tracks' in view)) {
                    continue
                  }
                  const tracks = view.tracks as Array<{
                    type: string
                    displays: Array<{
                      type: string
                      getCellBarcodesInRegion?: (
                        region: Region,
                      ) => Promise<Set<string>>
                    }>
                  }>
                  for (const track of tracks) {
                    if (track.type !== 'SingleCellAlignmentsTrack') {
                      continue
                    }
                    for (const display of track.displays) {
                      if (display.getCellBarcodesInRegion) {
                        const displayBarcodes =
                          await display.getCellBarcodesInRegion(region)
                        if (!isAlive(self)) return
                        for (const barcode of displayBarcodes) {
                          barcodes.add(barcode)
                        }
                      }
                    }
                  }
                }
              } catch (e) {
                if (!isAlive(self)) return
                session.notify(
                  `Failed to highlight cells from region: ${
                    e instanceof Error ? e.message : String(e)
                  }`,
                  'error',
                )
                return
              }

              if (!isAlive(self)) return
              const data = self.data
              const indices = new Set<number>()
              if (data?.cellBarcodes.length) {
                for (let i = 0; i < data.cellBarcodes.length; i++) {
                  if (barcodes.has(data.cellBarcodes[i]!)) {
                    indices.add(i)
                  }
                }
              }
              self.setHighlightedCells(indices)
            },
          ),
        )
      },
    }))
    .actions(self => ({
      /**
       * #action
       * Set selected cell indices directly (e.g. from lasso/rect selection).
       * Does NOT automatically sync to session; call applySelection() to push.
       */
      setSelectedCells(cells: Set<number>) {
        self.selectedCells = cells
      },
    }))
}

export default stateModelFactory

export type SingleCellViewStateModel = ReturnType<typeof stateModelFactory>
export type SingleCellViewModel = Instance<SingleCellViewStateModel>
