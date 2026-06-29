import Plugin from '@jbrowse/core/Plugin'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { isAbstractMenuManager } from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'
import ScatterPlotIcon from '@mui/icons-material/ScatterPlot'

import SingleCellAdapterF from './SingleCellAdapter/index.ts'
import SingleCellViewF from './SingleCellView/index.ts'
import SingleCellAlignmentsTrackF from './SingleCellView/SingleCellAlignmentsTrack/index.ts'
import SingleCellPileupDisplayF from './SingleCellView/SingleCellPileupDisplay/index.ts'
import SingleCellSNPCoverageDisplayF from './SingleCellView/SingleCellSNPCoverageDisplay/index.ts'
import { SingleCellSelection } from './SessionExtension.ts'
import LinearGenomeViewExtensionF from './LinearGenomeViewExtension.ts'

import type { IAnyModelType } from '@jbrowse/mobx-state-tree'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AbstractSessionModel } from '@jbrowse/core/util'

export default class SingleCellPlugin extends Plugin {
  name = 'SingleCellPlugin'

  /**
   * #config configuration.SingleCellPlugin
   */
  configurationSchema = ConfigurationSchema('SingleCellPlugin', {
    /**
     * #slot
     * Preset single-cell datasets shown in the SingleCellView import form.
     * Each entry should have { name: string, uri: string }.
     */
    datasets: {
      type: 'frozen',
      defaultValue: [],
    },
  })

  install(pluginManager: PluginManager) {
    SingleCellViewF(pluginManager)
    SingleCellAdapterF(pluginManager)
    SingleCellPileupDisplayF(pluginManager)
    SingleCellSNPCoverageDisplayF(pluginManager)
    SingleCellAlignmentsTrackF(pluginManager)
    LinearGenomeViewExtensionF(pluginManager)

    pluginManager.addToExtensionPoint(
      'Core-extendSession',
      (sessionModel: IAnyModelType) => {
        return types.compose(
          'SingleCellExtendedSession',
          sessionModel,
          SingleCellSelection,
        )
      },
    )
  }

  configure(pluginManager: PluginManager) {
    if (isAbstractMenuManager(pluginManager.rootModel)) {
      pluginManager.rootModel.appendToSubMenu(['Add'], {
        label: 'Single cell view',
        icon: ScatterPlotIcon,
        onClick: (session: AbstractSessionModel) => {
          session.addView('SingleCellView', {})
        },
      })
    }
  }
}

export { type SingleCellViewModel } from './SingleCellView/model.ts'
