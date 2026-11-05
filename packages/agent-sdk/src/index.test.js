// Regression tests for the agent-facing surface of the SDK. The host app is
// faked (session handle + plugin manager) because these tests are about the
// SDK's own contract: old fields keep their shape, new fields appear only when
// there is something to say, and the feature-chart surface is read through the
// extension points the plugin publishes.
import './index.js'

const createAgent = () => window.__createJBrowseAgent()

const DRAWER_CATALOG_EXTENSION_POINT = 'Core-featureChartDrawerCatalog'
const SPEC_SCHEMA_EXTENSION_POINT = 'Core-featureChartSpecSchema'

function makeSession(overrides = {}) {
  return {
    views: [],
    tracks: [
      {
        trackId: 'genes',
        name: 'Genes',
        type: 'FeatureTrack',
        adapter: { type: 'Gff3TabixAdapter', uri: 'genes.gff.gz' },
        assemblyNames: ['hg38'],
        category: ['Annotation'],
      },
      {
        trackId: 'fc',
        name: 'FC',
        type: 'FeatureChartTrack',
        assemblyNames: ['hg38'],
        category: [],
      },
    ],
    sessionTracks: [],
    assemblies: [],
    assemblyNames: ['hg38'],
    ...overrides,
  }
}

function makePluginManager({ drawers, specSchema, trackTypes } = {}) {
  return {
    evaluateExtensionPoint(name) {
      if (name === DRAWER_CATALOG_EXTENSION_POINT) {
        return drawers || null
      }
      if (name === SPEC_SCHEMA_EXTENSION_POINT) {
        return specSchema || null
      }
      return null
    },
    getElementTypesInGroup(group) {
      return group === 'track'
        ? (trackTypes ?? [{ name: 'FeatureChartTrack' }])
        : []
    },
    getViewElements() {
      return []
    },
  }
}

beforeEach(() => {
  delete window.JBrowseSession
  delete window.JBrowseRootModel
  delete window.__jbrowseTrackInfo
})

describe('trackInfo: legacy fields', () => {
  test('keeps the pre-WP5 shape, and adds nothing without a host bridge', () => {
    window.JBrowseSession = makeSession()
    const [track] = createAgent().tracks({ name: 'genes' })
    expect(track).toEqual({
      id: 'genes',
      name: 'Genes',
      type: 'FeatureTrack',
      adapter: 'Gff3TabixAdapter',
      assemblyNames: ['hg38'],
      category: ['Annotation'],
      open: false,
    })
    // absent, not empty strings: a prompt must not receive "info: "
    expect(track).not.toHaveProperty('info')
    expect(track).not.toHaveProperty('infoText')
  })

  test('track() by name keeps the legacy fields and candidate errors', () => {
    window.JBrowseSession = makeSession()
    const agent = createAgent()
    expect(agent.track('genes')).toMatchObject({
      id: 'genes',
      type: 'FeatureTrack',
    })
    expect(() => agent.track('nope')).toThrow(/TRACK_NOT_FOUND/)
  })
})

describe('trackInfo: info and infoText', () => {
  test('tracks() and track() both carry the rendered info', () => {
    window.JBrowseSession = makeSession()
    window.__jbrowseTrackInfo = conf => ({
      info: `## ${conf.name}\n\n**source**`,
      infoText: `${conf.name}\n\nsource`,
      visible: true,
      hideUris: false,
    })
    const agent = createAgent()
    const [track] = agent.tracks({ name: 'genes' })
    expect(track.info).toBe('## Genes\n\n**source**')
    expect(track.infoText).toBe('Genes\n\nsource')
    expect(agent.track('genes')).toMatchObject({
      id: 'genes',
      info: '## Genes\n\n**source**',
      infoText: 'Genes\n\nsource',
    })
  })

  test('a track without info omits the fields instead of writing empty strings', () => {
    window.JBrowseSession = makeSession()
    window.__jbrowseTrackInfo = () => ({
      info: '',
      infoText: '',
      visible: false,
      hideUris: false,
    })
    const [track] = createAgent().tracks()
    expect(track).not.toHaveProperty('info')
    expect(track).not.toHaveProperty('infoText')
  })

  test('a host that publishes only info still works (infoText omitted)', () => {
    window.JBrowseSession = makeSession()
    window.__jbrowseTrackInfo = () => ({ info: 'plain', visible: true })
    const [track] = createAgent().tracks()
    expect(track.info).toBe('plain')
    expect(track).not.toHaveProperty('infoText')
  })

  test('tracks({}, { info: false }) skips the bridge (digest() does)', () => {
    window.JBrowseSession = makeSession()
    let calls = 0
    window.__jbrowseTrackInfo = conf => {
      calls++
      return { info: `about ${conf.trackId}`, visible: true }
    }
    const agent = createAgent()
    const [track] = agent.tracks(undefined, { info: false })
    expect(track).not.toHaveProperty('info')
    expect(calls).toBe(0)
    // and the digest uses that path, so a per-run digest stays cheap
    expect(agent.digest()).toBeTruthy()
    expect(calls).toBe(0)
  })

  test('one broken track info does not throw; the warning reaches the digest', () => {
    window.JBrowseSession = makeSession()
    window.__jbrowseTrackInfo = () => {
      throw new Error('template blew up')
    }
    const agent = createAgent()
    const tracks = agent.tracks()
    expect(tracks).toHaveLength(2)
    expect(tracks[0]).not.toHaveProperty('info')
    expect(agent.digest().warnings?.join('\n')).toMatch(
      /track-info bridge threw/,
    )
  })
})

describe('chartDrawers()', () => {
  const drawers = [
    {
      name: 'barPlot',
      displayName: 'Bar plot',
      description: 'one bar per category',
      dataShape: 'category-values',
      builtin: true,
      defaultSize: { width: 120, height: 180 },
    },
    {
      name: 'samplePlugin/heatmap',
      displayName: 'Heatmap',
      description: 'plugin contributed',
      dataShape: 'grouped-values',
      builtin: false,
      optionsSchema: { colorRamp: 'string' },
    },
  ]

  test('lists the catalog with builtin and optionsSchema', () => {
    window.JBrowseSession = makeSession()
    window.JBrowseRootModel = { pluginManager: makePluginManager({ drawers }) }
    const agent = createAgent()
    expect(agent.chartDrawers()).toHaveLength(2)
    expect(agent.chartDrawers()[1]).toMatchObject({
      name: 'samplePlugin/heatmap',
      builtin: false,
      dataShape: 'grouped-values',
      optionsSchema: { colorRamp: 'string' },
    })
    expect(agent.chartDrawers()[0].builtin).toBe(true)
  })

  test('throws FEATURE_CHART_UNAVAILABLE when the plugin surface is absent', () => {
    window.JBrowseSession = makeSession()
    window.JBrowseRootModel = { pluginManager: makePluginManager() }
    expect(() => createAgent().chartDrawers()).toThrow(
      /FEATURE_CHART_UNAVAILABLE/,
    )
  })

  test('chartDrawer(name) resolves one entry and lists candidates on a typo', () => {
    window.JBrowseSession = makeSession()
    window.JBrowseRootModel = { pluginManager: makePluginManager({ drawers }) }
    const agent = createAgent()
    expect(agent.chartDrawer('barPlot')).toMatchObject({ name: 'barPlot' })
    let error
    try {
      agent.chartDrawer('barplot')
    } catch (e) {
      error = e
    }
    expect(error.code).toBe('UNKNOWN_DRAWER')
    expect(error.candidates).toEqual(['barPlot', 'samplePlugin/heatmap'])
  })
})

describe('chartSpecSchema()', () => {
  test('returns the published vocabulary', () => {
    window.JBrowseSession = makeSession()
    window.JBrowseRootModel = {
      pluginManager: makePluginManager({
        drawers: [{ name: 'barPlot', builtin: true }],
        specSchema: {
          $id: 'jbrowse-feature-chart-spec',
          kinds: ['box', 'bar'],
          dataForms: ['category-values'],
          kindDataForms: { bar: ['category-values'] },
          bins: { min: 1, max: 100, default: 10 },
          colorSchemes: ['viridis'],
          properties: {},
        },
      }),
    }
    const schema = createAgent().chartSpecSchema()
    expect(schema.kinds).toEqual(['box', 'bar'])
    expect(schema.kindDataForms.bar).toEqual(['category-values'])
  })

  test('throws FEATURE_CHART_UNAVAILABLE when the plugin surface is absent', () => {
    window.JBrowseSession = makeSession()
    window.JBrowseRootModel = { pluginManager: makePluginManager() }
    expect(() => createAgent().chartSpecSchema()).toThrow(
      /FEATURE_CHART_UNAVAILABLE/,
    )
  })
})

describe('selfTest() covers the new surface', () => {
  test('reports the three new checks and the feature-chart ones pass', () => {
    window.JBrowseSession = makeSession()
    window.JBrowseRootModel = {
      pluginManager: makePluginManager({
        drawers: [
          {
            name: 'barPlot',
            displayName: 'Bar plot',
            description: 'one bar per category',
            dataShape: 'category-values',
            builtin: true,
          },
        ],
        specSchema: { kinds: ['bar'] },
      }),
    }
    const result = createAgent().selfTest()
    const byName = Object.fromEntries(
      result.checks.map(c => [c.name, c.status]),
    )
    // no host bridge in this fake: a skip, never a silent pass
    expect(byName['track-info-bridge']).toBe('skip')
    expect(byName['feature-chart-catalog']).toBe('pass')
    expect(byName['chart-spec-schema']).toBe('pass')
  })

  test('fails the catalog check when the plugin is loaded but publishes nothing', () => {
    window.JBrowseSession = makeSession()
    window.JBrowseRootModel = { pluginManager: makePluginManager() }
    const result = createAgent().selfTest()
    const byName = Object.fromEntries(
      result.checks.map(c => [c.name, c.status]),
    )
    expect(byName['feature-chart-catalog']).toBe('fail')
    expect(byName['chart-spec-schema']).toBe('fail')
    expect(result.ok).toBe(false)
  })

  test('skips the feature-chart checks in an app without the plugin (e.g. cgv)', () => {
    window.JBrowseSession = makeSession()
    window.JBrowseRootModel = {
      pluginManager: makePluginManager({
        trackTypes: [{ name: 'FeatureTrack' }],
      }),
    }
    const result = createAgent().selfTest()
    const byName = Object.fromEntries(
      result.checks.map(c => [c.name, c.status]),
    )
    expect(byName['feature-chart-catalog']).toBe('skip')
    expect(byName['chart-spec-schema']).toBe('skip')
  })
})
