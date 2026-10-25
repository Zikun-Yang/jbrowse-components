import { lazy } from 'react'

import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'

import { SyntenyViewIcon } from '@jbrowse/core/ui/Icons'

import modelFactory from './model.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function LinearSyntenyViewF(pluginManager: PluginManager) {
  pluginManager.addViewType(() => {
    return new ViewType({
      name: 'LinearSyntenyView',
      displayName: 'Linear synteny view',
      description:
        'Multi-genome linear synteny comparison: N genome rows (one ' +
        'assembly each) with synteny ribbon tracks drawn in the levels ' +
        'between adjacent rows. Supports linked navigation, CIGAR/curve ' +
        'rendering, per-row tracks, and SVG/PNG export. With follow-synteny ' +
        'mode enabled, giving coordinates in ONE genome automatically maps ' +
        'them through the alignments and re-centers the other rows on the ' +
        'corresponding regions — ideal for anchoring on a locus in one ' +
        'species and inspecting its syntenic relationships (or absence ' +
        'thereof) across the others. Open programmatically with an init ' +
        'snapshot: { views: [{ loc, assembly, tracks? }], ' +
        'tracks?: string[][] } where tracks[i] lists synteny track ids for ' +
        'the level between views[i] and views[i+1]. Requires SyntenyTracks ' +
        'between the assemblies.',
      icon: SyntenyViewIcon,
      stateModel: modelFactory(pluginManager),
      ReactComponent: lazy(() => import('./components/LinearSyntenyView.tsx')),
    })
  })
}
