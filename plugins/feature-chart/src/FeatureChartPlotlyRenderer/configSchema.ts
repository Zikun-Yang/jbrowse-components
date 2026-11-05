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
     * **Deprecated.** Kept as a compatibility alias for `spec.kind`, so a track
     * written before the two backends were unified keeps rendering. It is only
     * consulted when `drawer` is left at its default; any explicit `drawer`
     * (including `"spec"`) wins, and using `plotType` logs one deprecation
     * warning with the equivalent spec.
     *
     * Migration:
     *
     * ```json
     * // before
     * { "type": "FeatureChartPlotlyRenderer", "plotType": "violin" }
     *
     * // after
     * {
     *   "type": "FeatureChartPlotlyRenderer",
     *   "drawer": "spec",
     *   "spec": {
     *     "specVersion": 1,
     *     "kind": "violin",
     *     "data": { "form": "grouped-values", "path": "tissues" }
     *   }
     * }
     * ```
     *
     * `scatter` and `line` have no `ChartModel` in the v1 vocabulary (no canvas
     * painter exists for them); they keep their legacy Plotly rendering under
     * the same warning and are removed in v2.
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
     * Per-drawer options (`DrawerProps.options`), passed to the same drawer
     * model builder the canvas renderer uses (see `drawerRegistry.ts`).
     */
    drawerOptions: {
      type: 'frozen',
      defaultValue: {},
    },

    /**
     * #slot
     * Declarative chart description (`plugins/feature-chart/SPEC.md`), rendered
     * when `drawer` is `"spec"` — now by *both* backends, from the same
     * normalized `ChartModel`, so a spec chart looks the same in a track and in
     * the interactive/maximized view.
     */
    spec: {
      type: 'frozen',
      defaultValue: {},
    },

    /**
     * #slot
     * Accepted so a track can switch between `FeatureChartRenderer` and this
     * renderer without losing configuration. Plotly keeps its own plot
     * instances (no canvas blitting), so this slot has no effect here.
     */
    renderCache: {
      type: 'boolean',
      defaultValue: true,
    },
  },
  { explicitlyTyped: true },
)

export default FeatureChartPlotlyRenderer
