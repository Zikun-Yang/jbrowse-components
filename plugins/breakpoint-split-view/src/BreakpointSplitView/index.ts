import { lazy } from 'react'

import { ViewType } from '@jbrowse/core/pluggableElementTypes'

import { BreakpointSplitViewIcon } from '@jbrowse/core/ui/Icons'

import stateModelFactory from './model.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function BreakpointSplitViewF(pluginManager: PluginManager) {
  pluginManager.addViewType(() => {
    return new ViewType({
      name: 'BreakpointSplitView',
      displayName: 'Breakpoint split view',
      description:
        'Split view showing both breakpoints of one structural variant ' +
        'side by side, connected by the supporting alignments. Typically ' +
        'opened from SV inspector workflows to examine the breakpoint ' +
        'evidence of a single SV.',
      icon: BreakpointSplitViewIcon,
      stateModel: stateModelFactory(pluginManager),
      ReactComponent: lazy(
        () => import('./components/BreakpointSplitView.tsx'),
      ),
    })
  })
}
