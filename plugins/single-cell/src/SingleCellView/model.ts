import { BaseViewModel } from '@jbrowse/core/pluggableElementTypes/models'
import { ElementId } from '@jbrowse/core/util/types/mst'
import { types } from '@jbrowse/mobx-state-tree'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { Instance } from '@jbrowse/mobx-state-tree'

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
        return !!self.dataset
      },
      /**
       * #getter
       */
      get showLoading() {
        return self.loading
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
    }))
}

export default stateModelFactory

export type SingleCellViewStateModel = ReturnType<typeof stateModelFactory>
export type SingleCellViewModel = Instance<SingleCellViewStateModel>
