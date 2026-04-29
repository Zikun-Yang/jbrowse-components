import { lazy } from 'react'

import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'

import stateModelFactory from './model.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function SingleCellViewF(pluginManager: PluginManager) {
  pluginManager.addViewType(
    () =>
      new ViewType({
        ReactComponent: lazy(() => import('./components/SingleCellView.tsx')),
        stateModel: stateModelFactory(pluginManager),
        name: 'SingleCellView',
        displayName: 'Single cell view',
      }),
  )
}
