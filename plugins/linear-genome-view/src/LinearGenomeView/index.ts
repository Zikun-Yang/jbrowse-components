import { lazy } from 'react'

import { ViewType } from '@jbrowse/core/pluggableElementTypes'

import { DNA } from '@jbrowse/core/ui/Icons'

import { stateModelFactory } from './model.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function LinearGenomeViewF(pluginManager: PluginManager) {
  pluginManager.addViewType(() => {
    return new ViewType({
      name: 'LinearGenomeView',
      displayName: 'Linear genome view',
      description:
        'The standard genome browser view: genomic regions laid out ' +
        'left-to-right with stacked data tracks (genes, reads, variants, ' +
        'coverage, ...). Supports navigation by coordinates or gene name, ' +
        'zooming, showing/hiding tracks, per-track display configuration, ' +
        'and SVG/PNG export. This is the default view for almost every task.',
      icon: DNA,
      stateModel: stateModelFactory(pluginManager),
      ReactComponent: lazy(() => import('./components/LinearGenomeView.tsx')),
    })
  })
}

export * from './model.ts'
export * from './types.ts'
