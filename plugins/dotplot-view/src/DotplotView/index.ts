import { lazy } from 'react'

import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'

import { DotplotViewIcon } from '@jbrowse/core/ui/Icons'

import stateModelFactory from './model.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function DotplotViewF(pluginManager: PluginManager) {
  pluginManager.addViewType(() => {
    return new ViewType({
      name: 'DotplotView',
      displayName: 'Dotplot view',
      description:
        '2D dotplot of alignments between two assemblies, one per axis. ' +
        'Good for inspecting large-scale synteny, inversions, duplications ' +
        'and rearrangements between two genomes. Requires a synteny/' +
        'alignment track between the two assemblies.',
      icon: DotplotViewIcon,
      stateModel: stateModelFactory(pluginManager),
      ReactComponent: lazy(() => import('./components/DotplotView.tsx')),
    })
  })
}
