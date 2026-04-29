import { BaseViewModel } from '@jbrowse/core/pluggableElementTypes/models'
import { getConf } from '@jbrowse/core/configuration'
import { flow, types } from '@jbrowse/mobx-state-tree'

import SingleCellZarrAdapter from '../SingleCellAdapter/SingleCellZarrAdapter.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { CategoricalColumn, ContinuousColumn } from '../SingleCellAdapter/SingleCellZarrAdapter.ts'

export type CellMetadata = Record<string, CategoricalColumn | ContinuousColumn>

export interface SingleCellDataset {
  nObs: number
  nVar: number
  obsColumns: string[]
  varColumns: string[]
  embeddings: string[]
  varNames: string[]
  metadata: CellMetadata
  embeddingData?: Float32Array
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
         * Current color-by field, e.g. 'cell_type', 'leiden'
         */
        colorBy: types.maybe(types.string),

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
       * Selected cell indices
       */
      selectedCells: new Set<number>() as Set<number>,
      /**
       * #property
       * Highlighted cell indices (hover)
       */
      highlightedCells: new Set<number>() as Set<number>,
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
      setEmbedding(name: string) {
        self.embedding = name
      },
      /**
       * #action
       */
      setColorBy(field: string) {
        self.colorBy = field
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
      setSelectedCells(cells: Set<number>) {
        self.selectedCells = cells
      },
      /**
       * #action
       */
      clearSelection() {
        self.selectedCells = new Set()
      },
      /**
       * #action
       */
      setHighlightedCells(cells: Set<number>) {
        self.highlightedCells = cells
      },
      /**
       * #action
       * Load dataset using SingleCellZarrAdapter
       */
      loadDataset: flow(function* (uri: string) {
        self.loading = true
        self.error = undefined
        try {
          const adapter = new SingleCellZarrAdapter(
            {
              zarrLocation: { uri },
            } as unknown as ReturnType<typeof import('../SingleCellAdapter/configSchema.ts').default.create>,
          )

          yield adapter.init()

          // Load default embedding
          const embeddings = adapter.embeddings
          const defaultEmbedding = embeddings.includes('X_umap')
            ? 'X_umap'
            : embeddings[0]

          let embeddingData: Float32Array | undefined
          if (defaultEmbedding) {
            embeddingData = yield adapter.getEmbedding(defaultEmbedding)
          }

          // Load metadata columns (first few for performance)
          const metadata: CellMetadata = {}
          const columnsToLoad = adapter.obsColumns.slice(0, 10)
          for (const col of columnsToLoad) {
            try {
              metadata[col] = yield adapter.getObsColumn(col)
            } catch {
              // skip columns that fail to load
            }
          }

          // Determine default colorBy
          const colorByCandidates = ['cell_type', 'leiden', 'louvain', 'cluster']
          const colorBy = colorByCandidates.find(c => adapter.obsColumns.includes(c))
            || adapter.obsColumns[0]

          self.data = {
            nObs: adapter.nObs,
            nVar: adapter.nVar,
            obsColumns: adapter.obsColumns,
            varColumns: adapter.varColumns,
            embeddings: adapter.embeddings,
            varNames: adapter.varNames,
            metadata,
            embeddingData,
          }
          self.dataset = uri
          self.embedding = defaultEmbedding
          self.colorBy = colorBy
        } catch (e) {
          self.error = e instanceof Error ? e.message : String(e)
          self.dataset = undefined
        } finally {
          self.loading = false
        }
      }),
    }))
}

export default stateModelFactory

export type SingleCellViewStateModel = ReturnType<typeof stateModelFactory>
export type SingleCellViewModel = Instance<SingleCellViewStateModel>
