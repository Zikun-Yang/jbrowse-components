import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

/**
 * #config FeatureChartTabixAdapter
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const FeatureChartTabixAdapter = ConfigurationSchema(
  'FeatureChartTabixAdapter',
  {
    /**
     * #slot
     */
    dataLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/my.tsv.gz',
        locationType: 'UriLocation',
      },
    },

    /**
     * #slot
     */
    index: ConfigurationSchema('FeatureChartTabixIndex', {
      /**
       * #slot index.indexType
       */
      indexType: {
        model: types.enumeration('IndexType', ['TBI', 'CSI']),
        type: 'stringEnum',
        defaultValue: 'TBI',
      },
      /**
       * #slot index.location
       */
      location: {
        type: 'fileLocation',
        defaultValue: {
          uri: '/path/to/my.tsv.gz.tbi',
          locationType: 'UriLocation',
        },
      },
    }),

    /**
     * #slot
     */
    format: {
      type: 'stringEnum',
      model: types.enumeration('FeatureChartFormat', ['tsv-json-payload']),
      defaultValue: 'tsv-json-payload',
    },
  },
  {
    explicitlyTyped: true,

    /**
     * #preProcessSnapshot
     *
     * Allows minimal config:
     * ```json
     * {
     *   "type": "FeatureChartTabixAdapter",
     *   "uri": "yourfile.tsv.gz"
     * }
     * ```
     */
    preProcessSnapshot: snap => {
      return snap.uri
        ? {
            ...snap,
            dataLocation: {
              uri: snap.uri,
              baseUri: snap.baseUri,
            },
            index: {
              location: {
                uri: `${snap.uri}.tbi`,
                baseUri: snap.baseUri,
              },
            },
          }
        : snap
    },
  },
)

export default FeatureChartTabixAdapter
