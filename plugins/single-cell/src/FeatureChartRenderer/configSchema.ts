import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

/**
 * #config FeatureChartRenderer
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const FeatureChartRenderer = ConfigurationSchema(
  'FeatureChartRenderer',
  {
    /**
     * #slot
     */
    drawer: {
      type: 'string',
      defaultValue: 'tissueBoxPlot',
    },

    /**
     * #slot
     */
    chartHeight: {
      type: 'number',
      defaultValue: 180,
    },

    /**
     * #slot
     */
    chartWidth: {
      type: 'number',
      defaultValue: 120,
    },

    /**
     * #slot
     */
    align: {
      type: 'stringEnum',
      model: types.enumeration('ChartAlign', ['left', 'right', 'center']),
      defaultValue: 'center',
    },

    /**
     * #slot
     */
    maxChartsPerView: {
      type: 'number',
      defaultValue: 100,
    },

    /**
     * #slot
     */
    minChartSpacingPx: {
      type: 'number',
      defaultValue: 4,
    },

    /**
     * #slot
     */
    colorScheme: {
      type: 'string',
      defaultValue: 'tableau10',
    },
  },
  { explicitlyTyped: true },
)

export default FeatureChartRenderer
