import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

/**
 * #config FeatureChartPlotlyRenderer
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const FeatureChartPlotlyRenderer = ConfigurationSchema(
  'FeatureChartPlotlyRenderer',
  {
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
    plotType: {
      type: 'stringEnum',
      model: types.enumeration('PlotlyPlotType', [
        'box',
        'bar',
        'scatter',
        'line',
        'violin',
      ]),
      defaultValue: 'box',
    },

    /**
     * #slot
     */
    colorScheme: {
      type: 'string',
      defaultValue: 'tableau10',
    },

    /**
     * #slot
     * Per-drawer options (`DrawerProps.options`). Accepted here so a track can
     * switch between this renderer and `FeatureChartRenderer` without losing
     * its configuration. The Plotly backend does not consume drawers yet (see
     * ARCHITECTURE.md, WP4): the slot is carried, not applied.
     */
    drawerOptions: {
      type: 'frozen',
      defaultValue: {},
    },
  },
  { explicitlyTyped: true },
)

export default FeatureChartPlotlyRenderer
