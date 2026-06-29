import { getSession } from '@jbrowse/core/util'

import { isSessionWithSingleCellSelection } from './SessionExtension.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type {
  PluggableElementType,
  ViewType,
} from '@jbrowse/core/pluggableElementTypes'
import type { LinearGenomeViewStateModel } from '@jbrowse/plugin-linear-genome-view'

/**
 * Extend LinearGenomeView with a rubber-band context menu item that sends the
 * selected region to the shared single-cell selection state.
 */
export default function LinearGenomeViewExtension(
  pluginManager: PluginManager,
) {
  pluginManager.addToExtensionPoint(
    'Core-extendPluggableElement',
    (pluggableElement: PluggableElementType) => {
      if (pluggableElement.name === 'LinearGenomeView') {
        const { stateModel } = pluggableElement as ViewType
        const lgv = stateModel as LinearGenomeViewStateModel
        const newStateModel = lgv.views(self => {
          const superRubberBandMenuItems = self.rubberBandMenuItems
          return {
            /**
             * #method
             */
            rubberBandMenuItems() {
              return [
                ...superRubberBandMenuItems(),
                {
                  label: 'Highlight cells in region',
                  onClick: () => {
                    const session = getSession(self)
                    if (!isSessionWithSingleCellSelection(session)) {
                      return
                    }
                    const { leftOffset, rightOffset } = self
                    const selectedRegions = self.getSelectedRegions(
                      leftOffset,
                      rightOffset,
                    )
                    if (!selectedRegions.length) {
                      session.notify('No region selected', 'warning')
                      return
                    }
                    session.singleCellSelection.setSelectedRegion(
                      selectedRegions[0],
                    )
                    session.notify(
                      'Region set. Single-cell view will highlight cells overlapping this region.',
                      'info',
                    )
                  },
                },
              ]
            },
          }
        })
        ;(pluggableElement as ViewType).stateModel = newStateModel
      }
      return pluggableElement
    },
  )
}
