import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'

import modelFactory from './model.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { IAnyModelType } from '@jbrowse/mobx-state-tree'

export default function SingleCellSNPCoverageDisplayF(
  pluginManager: PluginManager,
) {
  pluginManager.addDisplayType(() => {
    const stateModel = modelFactory(pluginManager)
    const baseDisplayType = pluginManager.getDisplayType('LinearSNPCoverageDisplay')!
    return new DisplayType({
      name: 'SingleCellSNPCoverageDisplay',
      displayName: 'Single-cell SNPCoverage display',
      configSchema: baseDisplayType.configSchema,
      stateModel: stateModel as IAnyModelType,
      trackType: 'SingleCellAlignmentsTrack',
      viewType: 'LinearGenomeView',
      ReactComponent: baseDisplayType.ReactComponent,
    })
  })
}
