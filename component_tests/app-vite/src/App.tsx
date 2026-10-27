import { useMemo } from 'react'

import { createViewState, JBrowseApp } from '@jbrowse/react-app2'
import { AboutDialog } from '@jbrowse/product-core'
import FeatureChartPlugin from '@jbrowse/plugin-feature-chart'

import assembly from './assembly'
import featureChartTracks, { FC_TRACK_IDS } from './featureChartTracks'
import tracks from './tracks'

/**
 * `?e2e=feature-chart` swaps in the FeatureChart fixture (see
 * `featureChartTracks.ts`). The default page stays the minimal smoke-test app.
 */
const params = new URLSearchParams(
  typeof window === 'undefined' ? '' : window.location.search,
)
const isFeatureChartE2e = params.get('e2e') === 'feature-chart'
/**
 * `&about=1` additionally mounts the real `AboutDialog` for one fixture track.
 * It is mounted directly (instead of driving the track menu) so the assertion is
 * about WP1's rendering, not about which selector component the session
 * happened to open.
 */
const showAbout = isFeatureChartE2e && params.get('about') === '1'

function featureChartConfig() {
  return {
    configuration: {
      // The point of this fixture: everything renders through the real RPC
      // worker, exactly like a product. Do not "fix" a failure here by
      // switching to MainThreadRpcDriver — that would silently test the wrong
      // code path (see the Cypress spec).
      rpc: { defaultDriver: 'WebWorkerRpcDriver' },
      formatAbout: {
        info: 'Site-wide fallback text; the track-level `formatAbout.info` wins.',
      },
    },
    assemblies: [assembly],
    tracks: featureChartTracks,
    defaultSession: {
      name: 'Feature chart e2e',
      views: [
        {
          id: 'fc_e2e_view',
          type: 'LinearGenomeView',
          init: {
            loc: 'ctgA:500-18500',
            assembly: 'volvox',
            tracks: [
              FC_TRACK_IDS.drawer,
              FC_TRACK_IDS.spec,
              FC_TRACK_IDS.unknownDrawer,
              FC_TRACK_IDS.brokenSpec,
            ],
          },
        },
      ],
      widgets: {
        hierarchicalTrackSelector: {
          id: 'hierarchicalTrackSelector',
          type: 'HierarchicalTrackSelectorWidget',
          filterText: '',
          view: 'fc_e2e_view',
        },
      },
      activeWidgets: {
        hierarchicalTrackSelector: 'hierarchicalTrackSelector',
      },
    },
  }
}

export default function App() {
  const state = useMemo(
    () =>
      createViewState({
        config: isFeatureChartE2e
          ? featureChartConfig()
          : { assemblies: [assembly], tracks },
        // WP0: products register the plugin; this app does the same so the
        // drawer catalog exists in both the main thread and the worker.
        plugins: [FeatureChartPlugin],
      }),
    [],
  )

  // Exposed for the Cypress spec, which asserts the RPC driver and the
  // session's track list without scraping the DOM.
  if (typeof window !== 'undefined') {
    ;(window as unknown as { __jbrowseState?: unknown }).__jbrowseState = state
  }

  const aboutTrack = showAbout
    ? state.jbrowse.tracks.find(
        (track: { trackId?: string }) => track.trackId === FC_TRACK_IDS.drawer,
      )
    : undefined

  return (
    <>
      <JBrowseApp viewState={state} />
      {aboutTrack ? (
        <AboutDialog
          config={aboutTrack}
          session={state.session}
          handleClose={() => {}}
        />
      ) : null}
    </>
  )
}
