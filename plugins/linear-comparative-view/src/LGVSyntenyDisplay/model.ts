import { ConfigurationReference } from '@jbrowse/core/configuration'
import {
  getContainingTrack,
  getContainingView,
  getSession,
  isSessionModelWithWidgets,
} from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'
import { SharedLinearPileupDisplayMixin } from '@jbrowse/plugin-alignments'

import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'

/**
 * #stateModel LGVSyntenyDisplay
 * displays location of "synteny" feature in a plain LGV, allowing linking out
 * to external synteny views
 *
 * extends
 * - [SharedLinearPileupDisplayMixin](../sharedlinearpileupdisplaymixin)
 */
function stateModelFactory(schema: AnyConfigurationSchemaType) {
  return types
    .compose(
      'LGVSyntenyDisplay',
      SharedLinearPileupDisplayMixin(schema),
      types.model({
        /**
         * #property
         */
        type: types.literal('LGVSyntenyDisplay'),
        /**
         * #property
         */
        configuration: ConfigurationReference(schema),
      }),
    )
    .views(self => {
      const {
        trackMenuItems: superTrackMenuItems,
        colorSchemeSubMenuItems: superColorSchemeSubMenuItems,
      } = self
      return {
        /**
         * #method
         */
        trackMenuItems() {
          return [
            ...superTrackMenuItems(),
            {
              label: 'Color scheme',
              subMenu: [...superColorSchemeSubMenuItems()],
            },
          ]
        },
      }
    })
    .actions(self => ({
      /**
       * #action
       */
      selectFeature(feature: Feature) {
        const session = getSession(self)
        if (isSessionModelWithWidgets(session)) {
          const r2 = getContainingView(self)
          let r3 = r2
          try {
            r3 = getContainingView(r3)
          } catch (e) {}
          const featureWidget = session.addWidget(
            'SyntenyFeatureWidget',
            'syntenyFeature',
            {
              featureData: feature.toJSON(),
              view: r3,
              track: getContainingTrack(self),
            },
          )
          session.showWidget(featureWidget)
        }
        session.setSelection(feature)
      },
      afterCreate() {
        // use color by strand to help indicate inversions better on first load,
        // otherwise use selected orientation
        if (!self.colorBySetting && self.colorBy.type === 'normal') {
          self.setColorScheme({ type: 'strand' })
        }
      },
    }))
}

export default stateModelFactory
