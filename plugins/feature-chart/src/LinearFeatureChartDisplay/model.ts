import { lazy } from 'react'

import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { BaseLinearDisplay } from '@jbrowse/plugin-linear-genome-view'
import { types } from '@jbrowse/mobx-state-tree'

import type PluginManager from '@jbrowse/core/PluginManager'
import type {
  AnyConfigurationModel,
  AnyConfigurationSchemaType,
} from '@jbrowse/core/configuration'
import type { AnyReactComponentType } from '@jbrowse/core/util'

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
        return 'FeatureChartRenderer'
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
         */
        renderProps() {
          const superProps = superRenderProps()
          return {
            ...superProps,
            config: self.rendererConfig,
            chartHeight: getConf(self, ['renderer', 'chartHeight']) as number,
            chartWidth: getConf(self, ['renderer', 'chartWidth']) as number,
            align: getConf(self, ['renderer', 'align']) as
              | 'left'
              | 'right'
              | 'center',
            maxChartsPerView: getConf(self, [
              'renderer',
              'maxChartsPerView',
            ]) as number,
            minChartSpacingPx: getConf(self, [
              'renderer',
              'minChartSpacingPx',
            ]) as number,
            drawer: getConf(self, ['renderer', 'drawer']) as string,
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
  import('@jbrowse/mobx-state-tree').Instance<LinearFeatureChartDisplayStateModel>
export default stateModelFactory
