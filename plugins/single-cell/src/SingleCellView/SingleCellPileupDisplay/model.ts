import { getSession, getEnv } from '@jbrowse/core/util'
import {
  linearPileupDisplayConfigSchemaFactory,
  linearPileupDisplayStateModelFactory,
} from '@jbrowse/plugin-alignments'
import { BaseLinearDisplayComponent } from '@jbrowse/plugin-linear-genome-view'
import { types, getSnapshot, isAlive } from '@jbrowse/mobx-state-tree'
import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'

import { isSessionWithSingleCellSelection } from '../../SessionExtension.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { Region } from '@jbrowse/core/util/types'
import type { Feature } from '@jbrowse/core/util'

/**
 * #stateModel SingleCellPileupDisplay
 *
 * A LinearPileupDisplay variant that injects the current single-cell selection
 * into adapter render props. The SingleCellBamAdapter uses `selectedCells` to
 * filter reads by cell barcode.
 */
function stateModelFactory(pluginManager: PluginManager) {
  const configSchema = linearPileupDisplayConfigSchemaFactory(pluginManager)
  const baseModel = linearPileupDisplayStateModelFactory(configSchema)

  const withSelectionProps = types.compose(
    'SingleCellPileupDisplay',
    baseModel,
    types
      .model({})
      .views(self => {
        const superAdapterRenderProps = (self as any)
          .adapterRenderProps as () => Record<string, unknown>
        return {
          /**
           * #method
           * Add selected cell barcodes to the props passed to the adapter.
           */
          adapterRenderProps() {
            const session = getSession(self as any)
            const selectedCells = isSessionWithSingleCellSelection(session)
              ? session.singleCellSelection.selectedCells
              : new Set<string>()
            return {
              ...superAdapterRenderProps(),
              selectedCells,
            }
          },
        }
      })
      .actions(self => {
        const superAdapterRenderProps = (self as any)
          .adapterRenderProps as () => Record<string, unknown>
        const selfAny = self as any
        return {
          /**
           * #action
           * Return the set of cell barcodes (CB/CR tags) observed in the given
           * genomic region. Used by SingleCellView for genome → cell highlighting.
           */
          async getCellBarcodesInRegion(region: Region): Promise<Set<string>> {
            if (!isAlive(self as any)) return new Set()
            const session = getSession(self as any)
            const { pluginManager } = getEnv(self as any)
            if (!session.id) {
              return new Set()
            }
            const adapterEntry = await getAdapter(
              pluginManager,
              session.id,
              getSnapshot(selfAny.adapterConfig),
            )
            if (!isAlive(self as any)) return new Set()
            const features = (
              adapterEntry.dataAdapter as {
                getFeatures: (
                  region: Region,
                  opts: unknown,
                ) => {
                  forEach: (cb: (feature: Feature) => void) => Promise<unknown>
                }
              }
            ).getFeatures(region, superAdapterRenderProps())
            const barcodes = new Set<string>()
            await features.forEach((feature: Feature) => {
              const tag =
                (feature.get('CB') as string | undefined) ??
                (feature.get('CR') as string | undefined)
              if (tag) {
                barcodes.add(tag)
              }
            })
            return barcodes
          },
        }
      }),
  )

  // The underlying LinearPileupDisplay model requires its own type literal for
  // internal dispatching. Accept snapshots under our display name but run as
  // LinearPileupDisplay so we can reuse its React component and behavior.
  return types.snapshotProcessor(withSelectionProps, {
    preProcessor(snap: { type?: string }) {
      return { ...snap, type: 'LinearPileupDisplay' as const }
    },
  })
}

export type SingleCellPileupDisplayStateModel = ReturnType<
  typeof stateModelFactory
>
export type SingleCellPileupDisplayModel =
  import('@jbrowse/mobx-state-tree').Instance<SingleCellPileupDisplayStateModel>
export default stateModelFactory
export { BaseLinearDisplayComponent as ReactComponent }
