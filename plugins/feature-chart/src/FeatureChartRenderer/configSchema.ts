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
     * Name of the drawer that paints each chart. Either one of the built-in
     * drawers (`precomputedBoxPlot`, `rawBoxPlot`, `rawViolinPlot`, `barPlot`,
     * `histogram`), or a drawer contributed by a plugin as
     * `<pluginName>/<drawerName>` through the `Core-featureChartDrawer`
     * extension point. Unknown names render a placeholder instead of failing
     * the track; a placeholder that says "missing plugin" usually means the
     * drawer's plugin is not listed in `config.plugins`.
     */
    drawer: {
      type: 'string',
      defaultValue: 'precomputedBoxPlot',
    },

    /**
     * #slot
     * Arbitrary JSON handed to the drawer as `DrawerProps.options`, so one
     * drawer can render several variants (colors, sizes, ramps, …) without a
     * new registration. Not validated by the config editor: each drawer
     * documents the keys it reads in `FeatureChartDrawerMeta.optionsSchema`
     * and clamps out-of-range values itself.
     */
    drawerOptions: {
      type: 'frozen',
      defaultValue: {},
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
