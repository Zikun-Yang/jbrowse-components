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
     * Name of the drawer that paints each chart. Must be one of the built-in
     * drawers (see `listFeatureChartDrawers()`) or a drawer registered at
     * runtime; unknown names render a placeholder instead of failing the track.
     */
    drawer: {
      type: 'string',
      defaultValue: 'precomputedBoxPlot',
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
     * Palette used by the built-in drawers. One of `tableau10`, `viridis`,
     * `set2`, `dark2`, `blues` (see `listColorSchemeNames()`).
     */
    colorScheme: {
      type: 'string',
      defaultValue: 'tableau10',
    },
  },
  { explicitlyTyped: true },
)

export default FeatureChartRenderer
