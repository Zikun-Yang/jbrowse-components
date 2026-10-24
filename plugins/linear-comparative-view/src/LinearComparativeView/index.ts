import { lazy } from 'react'

import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'

import { SyntenyViewIcon } from '@jbrowse/core/ui/Icons'

import modelFactory from './model.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function LinearComparativeViewF(pluginManager: PluginManager) {
  pluginManager.addViewType(() => {
    return new ViewType({
      name: 'LinearComparativeView',
      description:
        'Base model of the multi-genome comparative view without the ' +
        'synteny drawing options; hidden from the GUI menu. In almost all ' +
        'cases, open a LinearSyntenyView instead.',
      viewMetadata: {
        hiddenFromGUI: true,
      },
      displayName: 'Linear comparative view',
      icon: SyntenyViewIcon,
      stateModel: modelFactory(pluginManager),
      ReactComponent: lazy(
        () => import('./components/LinearComparativeView.tsx'),
      ),
    })
  })
}
