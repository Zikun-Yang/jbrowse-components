import { types } from '@jbrowse/mobx-state-tree'

import type { Region } from '@jbrowse/core/util/types'

/**
 * Shared session state for single-cell ↔ genome linkage.
 *
 * Registered via Core-extendSession in the plugin's install() method.
 */
export const SingleCellSelection = types
  .model('SingleCellSelection', {
    /**
     * #property
     * Selected cell barcodes (from obs index column)
     */
    selectedCells: types.frozen<Set<string>>(new Set<string>()),
    /**
     * #property
     * Region selected in LinearGenomeView to highlight cells
     */
    selectedRegion: types.maybe(types.frozen<Region>()),
    /**
     * #property
     * ID of the SingleCellView that currently owns the selection
     */
    activeSingleCellViewId: types.maybe(types.string),
  })
  .actions(self => ({
    /**
     * #action
     */
    setSelectedCells(cells: Set<string>) {
      self.selectedCells = cells as unknown as typeof self.selectedCells
    },
    /**
     * #action
     */
    setSelectedRegion(region?: Region) {
      self.selectedRegion = region
    },
    /**
     * #action
     */
    setActiveSingleCellViewId(id?: string) {
      self.activeSingleCellViewId = id
    },
    /**
     * #action
     */
    clearSelection() {
      self.selectedCells = new Set() as unknown as typeof self.selectedCells
      self.selectedRegion = undefined
    },
  }))

export type SingleCellSelectionType = typeof SingleCellSelection

export interface SessionWithSingleCellSelection {
  singleCellSelection: {
    selectedCells: Set<string>
    selectedRegion?: Region
    activeSingleCellViewId?: string
    setSelectedCells(cells: Set<string>): void
    setSelectedRegion(region?: Region): void
    setActiveSingleCellViewId(id?: string): void
    clearSelection(): void
  }
}

export function isSessionWithSingleCellSelection(
  session: unknown,
): session is SessionWithSingleCellSelection {
  return (
    typeof session === 'object' &&
    session !== null &&
    'singleCellSelection' in session
  )
}
