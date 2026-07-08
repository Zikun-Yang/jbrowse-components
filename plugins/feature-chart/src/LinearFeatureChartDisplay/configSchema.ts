import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { baseLinearDisplayConfigSchema } from '@jbrowse/plugin-linear-genome-view'

import type PluginManager from '@jbrowse/core/PluginManager'

/**
 * #config LinearFeatureChartDisplay
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

function configSchemaFactory(pluginManager: PluginManager) {
  return ConfigurationSchema(
    'LinearFeatureChartDisplay',
    {
      /**
       * #slot
       */
      renderer: pluginManager.pluggableConfigSchemaType('renderer'),
    },
    {
      /**
       * #baseConfiguration
       */
      baseConfiguration: baseLinearDisplayConfigSchema,
      explicitlyTyped: true,
    },
  )
}

export default configSchemaFactory
