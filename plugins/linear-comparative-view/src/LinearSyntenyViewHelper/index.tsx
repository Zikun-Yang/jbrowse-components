import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'

import { linearSyntenyViewHelperModelFactory } from './stateModelFactory.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

function UnusedComponent() {
  return <div />
}

export default function LinearSyntenyViewF(pluginManager: PluginManager) {
  pluginManager.addViewType(() => {
    return new ViewType({
      name: 'LinearSyntenyViewHelper',
      displayName: 'Linear synteny view (helper)',
      description:
        'Internal sub-view used inside linear comparative/synteny views to ' +
        'render one level. Not meant to be opened directly.',
      viewMetadata: {
        hiddenFromGUI: true,
      },
      stateModel: linearSyntenyViewHelperModelFactory(pluginManager),
      ReactComponent: UnusedComponent,
    })
  })
}
