import Plugin from '@jbrowse/core/Plugin'
import { isAbstractMenuManager } from '@jbrowse/core/util'
import ScatterPlotIcon from '@mui/icons-material/ScatterPlot'

import SingleCellViewF from './SingleCellView/index.ts'
import SingleCellAdapterF from './SingleCellAdapter/index.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AbstractSessionModel } from '@jbrowse/core/util'

export default class SingleCellPlugin extends Plugin {
  name = 'SingleCellPlugin'

  install(pluginManager: PluginManager) {
    SingleCellViewF(pluginManager)
    SingleCellAdapterF(pluginManager)
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
