import { lazy } from 'react'

import WidgetType from '@jbrowse/core/pluggableElementTypes/WidgetType'

import { configSchema } from './configSchema.ts'
import { stateModelFactory } from './stateModelFactory.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function VariantFeatureWidgetF(pluginManager: PluginManager) {
  pluginManager.addWidgetType(
    () =>
      new WidgetType({
        name: 'VariantFeatureWidget',
        heading: 'Feature details',
        configSchema: configSchema,
        stateModel: stateModelFactory(pluginManager),
        modalByDefault: true,
        ReactComponent: lazy(() => import('./VariantFeatureWidget.tsx')),
      }),
  )
}
