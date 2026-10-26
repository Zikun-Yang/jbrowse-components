import { lazy } from 'react'

import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'
import { BaseLinearDisplay } from '@jbrowse/plugin-linear-genome-view'

import type PluginManager from '@jbrowse/core/PluginManager'
import type {
  AnyConfigurationModel,
  AnyConfigurationSchemaType,
} from '@jbrowse/core/configuration'
import type { AnyReactComponentType } from '@jbrowse/core/util'
import type { Instance } from '@jbrowse/mobx-state-tree'

const Tooltip = lazy(() => import('./components/Tooltip.tsx'))

function stateModelFactory(
  _pluginManager: PluginManager,
  configSchema: AnyConfigurationSchemaType,
) {
  return types
    .compose(
      'LinearFeatureChartDisplay',
      BaseLinearDisplay,
      types.model({
        /**
         * #property
         */
        type: types.literal('LinearFeatureChartDisplay'),
        /**
         * #property
         */
        configuration: ConfigurationReference(configSchema),
      }),
    )
    .views(self => ({
      /**
       * #getter
       */
      get TooltipComponent() {
        return Tooltip as AnyReactComponentType
      },

      /**
       * #getter
       */
      get rendererTypeName() {
        return getConf(self, ['renderer', 'type']) as string
      },

      /**
       * #getter
       */
      get height() {
        return getConf(self, ['renderer', 'chartHeight']) as number
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get rendererConfig() {
        return getConf(self, ['renderer']) as AnyConfigurationModel
      },
    }))
    .views(self => {
      const { renderProps: superRenderProps } = self
      return {
        /**
         * #method
         *
         * Only the renderer config itself is passed through: chart geometry
         * (drawer, width, height, alignment, density limits) is read from
         * `config` inside the renderer, so new renderer slots never require a
         * display change (see `plugins/feature-chart/ARCHITECTURE.md`).
         */
        renderProps() {
          const superProps = superRenderProps()
          return {
            ...superProps,
            config: self.rendererConfig,
            theme: superProps.theme,
          }
        },
      }
    })
}

export type LinearFeatureChartDisplayStateModel = ReturnType<
  typeof stateModelFactory
>
export type LinearFeatureChartDisplayModel =
  Instance<LinearFeatureChartDisplayStateModel>
export default stateModelFactory
