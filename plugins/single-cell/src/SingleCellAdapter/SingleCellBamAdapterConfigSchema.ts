import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config SingleCellBamAdapter
 *
 * Wraps a BAM/CRAM adapter and filters features by a cell barcode tag.
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const configSchema = ConfigurationSchema(
  'SingleCellBamAdapter',
  {
    /**
     * #slot
     * Underlying BAM/CRAM adapter config
     */
    subadapter: {
      type: 'frozen',
      defaultValue: null,
    },
    /**
     * #slot
     * SAM tag that holds the cell barcode (default: 10x CB)
     */
    cellBarcodeTag: {
      type: 'string',
      defaultValue: 'CB',
    },
  },
  { explicitlyTyped: true },
)

export default configSchema
