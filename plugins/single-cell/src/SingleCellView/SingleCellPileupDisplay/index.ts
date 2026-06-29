import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'

import modelFactory, { ReactComponent } from './model.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { IAnyModelType } from '@jbrowse/mobx-state-tree'

export default function SingleCellPileupDisplayF(pluginManager: PluginManager) {
  pluginManager.addDisplayType(() => {
    const stateModel = modelFactory(pluginManager)
    return new DisplayType({
      name: 'SingleCellPileupDisplay',
      displayName: 'Single-cell pileup display',
      configSchema: pluginManager.getDisplayType('LinearPileupDisplay')!
        .configSchema,
      stateModel: stateModel as IAnyModelType,
      trackType: 'SingleCellAlignmentsTrack',
      viewType: 'LinearGenomeView',
      ReactComponent,
    })
  })
}
