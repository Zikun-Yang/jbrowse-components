import { lazy } from 'react'

import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'

import { CircularViewIcon } from '@jbrowse/core/ui/Icons'

import stateModelFactory from './model.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function CircularViewF(pluginManager: PluginManager) {
  pluginManager.addViewType(
    () =>
      new ViewType({
        ReactComponent: lazy(() => import('./components/CircularView.tsx')),
        stateModel: stateModelFactory(pluginManager),
        name: 'CircularView',
        displayName: 'Circular view',
        description:
          'Whole-genome circular (circos-style) overview: chromosomes form ' +
          'a ring and tracks render as concentric layers. Good for ' +
          'genome-wide patterns and large structural variants across all ' +
          'chromosomes at once; not for locus-level detail.',
        icon: CircularViewIcon,
      }),
  )
}
