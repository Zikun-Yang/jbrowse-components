import { getSession, getEnv } from '@jbrowse/core/util'
import { types, isAlive } from '@jbrowse/mobx-state-tree'
import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'

import { isSessionWithSingleCellSelection } from '../../SessionExtension.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { Region } from '@jbrowse/core/util/types'
import type { Feature } from '@jbrowse/core/util'

/**
 * #stateModel SingleCellSNPCoverageDisplay
 *
 * A LinearSNPCoverageDisplay variant that injects the current single-cell
 * selection into adapter props. The underlying SingleCellBamAdapter uses
 * `selectedCells` to filter reads by cell barcode before coverage is computed.
 */
function stateModelFactory(pluginManager: PluginManager) {
  const baseDisplayType = pluginManager.getDisplayType(
    'LinearSNPCoverageDisplay',
  )
  if (!baseDisplayType) {
    throw new Error(
      'SingleCellSNPCoverageDisplay requires LinearSNPCoverageDisplay to be registered',
    )
  }

  const baseModel = baseDisplayType.stateModel
  const configSchema = baseDisplayType.configSchema

  const withSelectionProps = types.compose(
    'SingleCellSNPCoverageDisplay',
    baseModel,
    types
      .model({})
      .views(self => {
        const superAdapterProps = (self as any).adapterProps as () => Record<
          string,
          unknown
        >
        return {
          /**
           * #method
           * Add selected cell barcodes to the props passed to the adapter.
           */
          adapterProps() {
            const session = getSession(self as any)
            const selectedCells = isSessionWithSingleCellSelection(session)
              ? session.singleCellSelection.selectedCells
              : new Set<string>()
            return {
              ...superAdapterProps(),
              // TODO: SNPCoverageAdapter caches by region+opts and does not
              // include selectedCells in its cache key, so changing the cell
              // selection may not refresh coverage until the cache is cleared.
              selectedCells,
            }
          },
        }
      })
      .actions(self => {
        const superAdapterProps = (self as any).adapterProps as () => Record<
          string,
          unknown
        >
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
            const { pluginManager: pm } = getEnv(self as any)
            if (!session.id) {
              return new Set()
            }
            const adapterEntry = await getAdapter(
              pm,
              session.id,
              selfAny.adapterConfig,
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
            ).getFeatures(region, superAdapterProps())
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

  // Run as LinearSNPCoverageDisplay internally so we can reuse its React
  // component and behavior.
  return types.snapshotProcessor(withSelectionProps, {
    preProcessor(snap: { type?: string }) {
      return { ...snap, type: 'LinearSNPCoverageDisplay' as const }
    },
  })
}

export type SingleCellSNPCoverageDisplayStateModel = ReturnType<
  typeof stateModelFactory
>
export type SingleCellSNPCoverageDisplayModel =
  import('@jbrowse/mobx-state-tree').Instance<SingleCellSNPCoverageDisplayStateModel>
export default stateModelFactory
