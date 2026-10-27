/**
 * E2E fixture: FeatureChart tracks for `component_tests/app-vite`.
 *
 * Loaded only when the page is opened with `?e2e=feature-chart`, so the existing
 * "does the app boot" smoke test is unchanged. The data files live in
 * `public/feature-chart/` and are the same bgzip+tabix TSVs the demo config in
 * `test_data/feature-chart` uses (four genes on `ctgA`), copied so the app is
 * self-contained.
 *
 * Nothing here configures an RPC driver: `App.tsx` sets
 * `configuration.rpc.defaultDriver: 'WebWorkerRpcDriver'`, and the spec asserts
 * it, because a chart rendered on the main-thread driver would not prove
 * anything about the worker path.
 */

const chartAdapter = (file: string) => ({
  type: 'FeatureChartTabixAdapter',
  dataLocation: {
    uri: `feature-chart/${file}.tsv.gz`,
    locationType: 'UriLocation',
  },
  index: {
    location: {
      uri: `feature-chart/${file}.tsv.gz.tbi`,
      locationType: 'UriLocation',
    },
  },
  format: 'tsv-json-payload',
})

export const FC_TRACK_IDS = {
  drawer: 'fc_e2e_drawer',
  spec: 'fc_e2e_spec',
  unknownDrawer: 'fc_e2e_unknown_drawer',
  brokenSpec: 'fc_e2e_broken_spec',
} as const

const tracks = [
  {
    type: 'FeatureChartTrack',
    trackId: FC_TRACK_IDS.drawer,
    name: 'FC · named drawer (rawBoxPlot)',
    category: ['Feature chart e2e'],
    // WP1: the About dialog renders this through the shared markdown pipeline.
    formatAbout: {
      info: '**{{track.name}}** data version `e2e-1`. This sentence comes from `formatAbout.info` and proves the Track info card renders.',
    },
    assemblyNames: ['volvox'],
    adapter: chartAdapter('raw-values'),
    displays: [
      {
        type: 'LinearFeatureChartDisplay',
        renderer: {
          type: 'FeatureChartRenderer',
          drawer: 'rawBoxPlot',
          chartWidth: 120,
          chartHeight: 180,
        },
      },
    ],
  },
  {
    type: 'FeatureChartTrack',
    trackId: FC_TRACK_IDS.spec,
    name: 'FC · spec (box)',
    category: ['Feature chart e2e'],
    assemblyNames: ['volvox'],
    adapter: chartAdapter('raw-values'),
    displays: [
      {
        type: 'LinearFeatureChartDisplay',
        renderer: {
          type: 'FeatureChartRenderer',
          drawer: 'spec',
          spec: {
            specVersion: 1,
            kind: 'box',
            data: { form: 'grouped-values', path: 'tissues' },
            axes: { yLabel: 'TPM' },
          },
        },
      },
    ],
  },
  {
    type: 'FeatureChartTrack',
    trackId: FC_TRACK_IDS.unknownDrawer,
    name: 'FC · unknown drawer',
    category: ['Feature chart e2e'],
    description: 'The drawer name does not exist: the track must stay alive.',
    assemblyNames: ['volvox'],
    adapter: chartAdapter('precomputed-box'),
    displays: [
      {
        type: 'LinearFeatureChartDisplay',
        renderer: {
          type: 'FeatureChartRenderer',
          drawer: 'nopeNotADrawer',
        },
      },
    ],
  },
  {
    type: 'FeatureChartTrack',
    trackId: FC_TRACK_IDS.brokenSpec,
    name: 'FC · invalid spec',
    category: ['Feature chart e2e'],
    assemblyNames: ['volvox'],
    adapter: chartAdapter('precomputed-box'),
    displays: [
      {
        type: 'LinearFeatureChartDisplay',
        renderer: {
          type: 'FeatureChartRenderer',
          drawer: 'spec',
          spec: {
            specVersion: 1,
            kind: 'violin',
            data: { form: 'summary-stats', path: 'boxes' },
          },
        },
      },
    ],
  },
]

export default tracks
