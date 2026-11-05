import {
  CHART_SPEC_SCHEMA_EXTENSION_POINT,
  chartSpecSchema,
} from './FeatureChartDrawer/chartSpecSchema.ts'
import {
  FEATURE_CHART_DRAWER_CATALOG_EXTENSION_POINT,
  listFeatureChartDrawerCatalog,
} from './FeatureChartDrawer/drawerRegistry.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

/**
 * Machine-readable surface for agents (and editors) that cannot import this
 * package: the drawer catalog and the chart-spec vocabulary, published through
 * the `PluginManager` as plain data.
 *
 * `@jbrowse/agent-sdk` is injected into the page as plain JS and only reaches
 * the app through `window.JBrowseRootModel.pluginManager`, so an extension
 * point is the one channel that works without a build-time dependency. It also
 * means the catalog an agent reads is the catalog the renderer resolves names
 * with — there is no second list to keep in sync.
 *
 * Both documents are *descriptive*: `optionsSchema` on a drawer is a hint, not
 * a validation contract, and `chartSpecSchema()` restates the vocabulary that
 * `validateChartSpec` (the only authority) enforces.
 *
 * Registered from `FeatureChartPlugin.install`, i.e. in every product that
 * loads the plugin (web, desktop, react-app — and their RPC workers).
 * Evaluating an extension point that nobody registered returns the initial
 * accumulator, which is exactly how the SDK detects "feature-chart is not
 * loaded here" instead of reporting an empty catalog as if it were the truth.
 */
export function installFeatureChartAgentSurface(pluginManager: PluginManager) {
  pluginManager.addToExtensionPoint(
    FEATURE_CHART_DRAWER_CATALOG_EXTENSION_POINT,
    () => listFeatureChartDrawerCatalog(pluginManager),
  )
  pluginManager.addToExtensionPoint(
    CHART_SPEC_SCHEMA_EXTENSION_POINT,
    () => chartSpecSchema(),
  )
}
