import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { baseLinearDisplayConfigSchema } from '@jbrowse/plugin-linear-genome-view'

import rendererConfigSchema from '../FeatureChartRenderer/configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

/**
 * #config LinearFeatureChartDisplay
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

function configSchemaFactory(_pluginManager: PluginManager) {
  return ConfigurationSchema(
    'LinearFeatureChartDisplay',
    {
      /**
       * #slot
       */
      renderer: rendererConfigSchema,
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
