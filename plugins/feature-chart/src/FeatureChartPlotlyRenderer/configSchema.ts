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

    /**
     * #slot
     * Declarative chart description (`plugins/feature-chart/SPEC.md`). Accepted
     * on this renderer so switching renderers keeps a track's configuration
     * intact, but **the Plotly backend does not render specs yet**: with
     * `drawer: "spec"` it shows an explicit "not supported here" warning
     * instead of pretending (unifying both backends is WP4). Use
     * `FeatureChartRenderer` for spec charts.
     */
    spec: {
      type: 'frozen',
      defaultValue: {},
    },
  },
  { explicitlyTyped: true },
)

export default FeatureChartPlotlyRenderer
