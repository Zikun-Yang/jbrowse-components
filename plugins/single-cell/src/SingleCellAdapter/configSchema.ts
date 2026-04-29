import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #configSchema SingleCellZarrAdapter
 *
 * Adapter for reading single-cell AnnData stored in Zarr format.
 *
 * Users should preprocess their .h5ad files with:
 *   adata.write_zarr('output.zarr/')
 *
 * This produces a Zarr directory tree containing obs, var, obsm, X, etc.
 */
const singleCellZarrAdapterConfigSchema = ConfigurationSchema(
  'SingleCellZarrAdapter',
  {
    /**
     * #slot
     */
    zarrLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '' },
    },
    /**
     * #slot
     * Default embedding to display (e.g. 'X_umap', 'X_tsne', 'X_pca')
     */
    defaultEmbedding: {
      type: 'string',
      defaultValue: 'X_umap',
    },
    /**
     * #slot
     * Default obs column to color by (e.g. 'cell_type', 'leiden')
     */
    defaultColorBy: {
      type: 'string',
      defaultValue: 'cell_type',
    },
    /**
     * #slot
     * Column in obs that contains the unique cell identifier / barcode
     */
    obsIndexColumn: {
      type: 'string',
      defaultValue: 'index',
    },
  },
)

export default singleCellZarrAdapterConfigSchema
