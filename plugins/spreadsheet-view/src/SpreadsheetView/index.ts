import { lazy } from 'react'

import { ViewType } from '@jbrowse/core/pluggableElementTypes'

import { SpreadsheetViewIcon } from '@jbrowse/core/ui/Icons'

import stateModelFactory from './SpreadsheetViewModel.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function SpreadsheetViewF(pluginManager: PluginManager) {
  pluginManager.addViewType(() => {
    return new ViewType({
      name: 'SpreadsheetView',
      displayName: 'Spreadsheet view',
      description:
        'Tabular view of a variant/feature file (VCF, BED, BEDPE, ' +
        'STAR-Fusion, ...) loaded through its import wizard; rows can be ' +
        'sorted and filtered. Usually driven by SvInspectorView rather ' +
        'than opened standalone.',
      icon: SpreadsheetViewIcon,
      stateModel: stateModelFactory(),
      ReactComponent: lazy(() => import('./components/SpreadsheetView.tsx')),
    })
  })
}

export type {
  SpreadsheetViewModel,
  SpreadsheetViewStateModel,
} from './SpreadsheetViewModel.ts'
