import { lazy } from 'react'

import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'

import { SingleCellViewIcon } from '@jbrowse/core/ui/Icons'

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
        description:
          'Single-cell embedding viewer (UMAP/t-SNE) for the configured ' +
          'single-cell dataset: color cells by metadata (obs), gene ' +
          'expression (feature), or gene sets; lasso/rectangle-select ' +
          'cell populations. Use it to explore clusters, inspect marker ' +
          'gene expression, and define cell subsets.',
        icon: SingleCellViewIcon,
      }),
  )
}
