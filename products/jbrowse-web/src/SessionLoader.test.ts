import { getSnapshot } from '@jbrowse/mobx-state-tree'

import SessionLoader from './SessionLoader.ts'

// Mock dependencies
jest.mock('@jbrowse/core/PluginLoader', () => {
  return jest.fn().mockImplementation(() => ({
    installGlobalReExports: jest.fn(),
    load: jest.fn().mockResolvedValue([]),
  }))
})

jest.mock('@jbrowse/core/util/io', () => ({
  openLocation: jest.fn().mockReturnValue({
    readFile: jest.fn().mockResolvedValue('{}'),
  }),
}))

jest.mock('./sessionSharing', () => ({
  readSessionFromDynamo: jest.fn(),
}))

jest.mock('./util', () => ({
  addRelativeUris: jest.fn(),
  checkPlugins: jest.fn().mockResolvedValue(true),
  fromUrlSafeB64: jest.fn().mockResolvedValue('{"id":"test","name":"Test"}'),
  readConf: jest.fn(),
}))

jest.mock('idb', () => ({
  openDB: jest.fn(),
}))

describe('SessionLoader', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    sessionStorage.clear()
    jest.spyOn(console, 'error').mockImplementation(() => {})
    jest.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('session type detection getters', () => {
    it('detects shared session', () => {
      const loader = SessionLoader.create({
        sessionQuery: 'share-abc123',
        initialTimestamp: Date.now(),
      })
      expect(loader.isSharedSession).toBe(true)
      expect(loader.isLocalSession).toBe(false)
      expect(loader.isEncodedSession).toBe(false)
    })

    it('detects local session', () => {
      const loader = SessionLoader.create({
        sessionQuery: 'local-abc123',
        initialTimestamp: Date.now(),
      })
      expect(loader.isLocalSession).toBe(true)
      expect(loader.isSharedSession).toBe(false)
    })

    it('detects encoded session', () => {
      const loader = SessionLoader.create({
        sessionQuery: 'encoded-abc123',
        initialTimestamp: Date.now(),
      })
      expect(loader.isEncodedSession).toBe(true)
      expect(loader.isLocalSession).toBe(false)
    })

    it('detects json session', () => {
      const loader = SessionLoader.create({
        sessionQuery: 'json-{"session":{}}',
        initialTimestamp: Date.now(),
      })
      expect(loader.isJsonSession).toBe(true)
    })

    it('detects spec session', () => {
      const loader = SessionLoader.create({
        sessionQuery: 'spec-{"views":[]}',
        initialTimestamp: Date.now(),
      })
      expect(loader.isSpecSession).toBe(true)
    })

    it('detects hub session', () => {
      const loader = SessionLoader.create({
        hubURL: ['https://example.com/hub.txt'],
        initialTimestamp: Date.now(),
      })
      expect(loader.isHubSession).toBe(true)
    })

    it('detects JB1 style session with loc', () => {
      const loader = SessionLoader.create({
        loc: 'chr1:1-1000',
        initialTimestamp: Date.now(),
      })
      expect(loader.isJb1StyleSession).toBe(true)
    })

    it('detects JB1 style session with assembly', () => {
      const loader = SessionLoader.create({
        assembly: 'hg38',
        initialTimestamp: Date.now(),
      })
      expect(loader.isJb1StyleSession).toBe(true)
    })

    it('returns false for all session types when no query', () => {
      const loader = SessionLoader.create({
        initialTimestamp: Date.now(),
      })
      expect(loader.isSharedSession).toBe(false)
      expect(loader.isLocalSession).toBe(false)
      expect(loader.isEncodedSession).toBe(false)
      expect(loader.isJsonSession).toBe(false)
      expect(loader.isSpecSession).toBe(false)
      expect(loader.isHubSession).toBe(false)
      expect(loader.isJb1StyleSession).toBe(false)
    })
  })

  describe('ready state getters', () => {
    it('isSessionLoaded is true when sessionSnapshot exists', () => {
      const loader = SessionLoader.create({
        sessionSnapshot: { id: 'test', name: 'Test Session' },
        initialTimestamp: Date.now(),
      })
      expect(loader.isSessionLoaded).toBe(true)
    })

    it('isSessionLoaded is true when blankSession is true', () => {
      const loader = SessionLoader.create({
        initialTimestamp: Date.now(),
      })
      loader.setBlankSession(true)
      expect(loader.isSessionLoaded).toBe(true)
    })

    it('isSessionLoaded is true when sessionError exists', () => {
      const loader = SessionLoader.create({
        initialTimestamp: Date.now(),
      })
      loader.setSessionError(new Error('test error'))
      expect(loader.isSessionLoaded).toBe(true)
    })

    it('isConfigLoaded is true when configSnapshot exists', () => {
      const loader = SessionLoader.create({
        configSnapshot: { assemblies: [] },
        initialTimestamp: Date.now(),
      })
      expect(loader.isConfigLoaded).toBe(true)
    })

    it('isConfigLoaded is true when configError exists', () => {
      const loader = SessionLoader.create({
        initialTimestamp: Date.now(),
      })
      loader.setConfigError(new Error('config error'))
      expect(loader.isConfigLoaded).toBe(true)
    })

    it('pluginsLoaded requires runtimePlugins for blank session', () => {
      const loader = SessionLoader.create({
        initialTimestamp: Date.now(),
      })
      loader.setBlankSession(true)
      expect(loader.pluginsLoaded).toBe(false)

      loader.setRuntimePlugins([])
      expect(loader.pluginsLoaded).toBe(true)
    })

    it('pluginsLoaded requires both runtime and session plugins for session with snapshot', () => {
      const loader = SessionLoader.create({
        sessionSnapshot: { id: 'test' },
        initialTimestamp: Date.now(),
      })
      expect(loader.pluginsLoaded).toBe(false)

      loader.setRuntimePlugins([])
      expect(loader.pluginsLoaded).toBe(false)

      loader.setSessionPlugins([])
      expect(loader.pluginsLoaded).toBe(true)
    })

    it('ready is true when session loaded, no config error, and plugins loaded', () => {
      const loader = SessionLoader.create({
        configSnapshot: { assemblies: [] },
        initialTimestamp: Date.now(),
      })
      loader.setBlankSession(true)
      loader.setRuntimePlugins([])
      expect(loader.ready).toBe(true)
    })

    it('ready is false when config error exists', () => {
      const loader = SessionLoader.create({
        initialTimestamp: Date.now(),
      })
      loader.setBlankSession(true)
      loader.setRuntimePlugins([])
      loader.setConfigError(new Error('config error'))
      expect(loader.ready).toBe(false)
    })
  })

  describe('actions', () => {
    it('setSessionSnapshot updates sessionSnapshot', () => {
      const loader = SessionLoader.create({
        initialTimestamp: Date.now(),
      })
      const snap = { id: 'test-id', name: 'Test' }
      loader.setSessionSnapshot(snap)
      expect(loader.sessionSnapshot).toEqual(snap)
    })

    it('setBlankSession updates blankSession', () => {
      const loader = SessionLoader.create({
        initialTimestamp: Date.now(),
      })
      expect(loader.blankSession).toBe(false)
      loader.setBlankSession(true)
      expect(loader.blankSession).toBe(true)
    })

    it('setConfigSnapshot updates configSnapshot', () => {
      const loader = SessionLoader.create({
        initialTimestamp: Date.now(),
      })
      const snap = { assemblies: [{ name: 'test' }] }
      loader.setConfigSnapshot(snap)
      expect(loader.configSnapshot).toEqual(snap)
    })

    it('setSessionError updates sessionError', () => {
      const loader = SessionLoader.create({
        initialTimestamp: Date.now(),
      })
      const err = new Error('test error')
      loader.setSessionError(err)
      expect(loader.sessionError).toBe(err)
    })

    it('setConfigError updates configError', () => {
      const loader = SessionLoader.create({
        initialTimestamp: Date.now(),
      })
      const err = new Error('config error')
      loader.setConfigError(err)
      expect(loader.configError).toBe(err)
    })
  })

  describe('sessionTracksParsed', () => {
    it('parses sessionTracks JSON', () => {
      const tracks = [{ type: 'TestTrack', trackId: 'track1' }]
      const loader = SessionLoader.create({
        sessionTracks: JSON.stringify(tracks),
        initialTimestamp: Date.now(),
      })
      expect(loader.sessionTracksParsed).toEqual(tracks)
    })

    it('returns empty array when sessionTracks is undefined', () => {
      const loader = SessionLoader.create({
        initialTimestamp: Date.now(),
      })
      expect(loader.sessionTracksParsed).toEqual([])
    })
  })

  describe('decodeSessionSpec', () => {
    it('decodes spec session query', () => {
      const spec = { views: [{ type: 'LinearGenomeView' }] }
      const loader = SessionLoader.create({
        sessionQuery: `spec-${JSON.stringify(spec)}`,
        initialTimestamp: Date.now(),
      })
      loader.decodeSessionSpec()
      expect(loader.sessionSpec).toEqual(spec)
    })
  })

  describe('decodeJb1StyleSession', () => {
    it('creates sessionSpec from loc and assembly', () => {
      const loader = SessionLoader.create({
        loc: 'chr1:1-1000',
        assembly: 'hg38',
        tracks: 'track1,track2',
        initialTimestamp: Date.now(),
      })
      loader.decodeJb1StyleSession()
      expect(loader.sessionSpec).toMatchObject({
        views: [
          {
            type: 'LinearGenomeView',
            loc: 'chr1:1-1000',
            assembly: 'hg38',
            tracks: ['track1', 'track2'],
          },
        ],
      })
    })
  })

  describe('decodeHubSpec', () => {
    it('creates hubSpec from hubURL', () => {
      const loader = SessionLoader.create({
        hubURL: ['https://example.com/hub.txt'],
        initialTimestamp: Date.now(),
      })
      loader.decodeHubSpec()
      expect(loader.hubSpec).toMatchObject({
        hubURL: ['https://example.com/hub.txt'],
      })
    })
  })

  describe('fetchSessionFromSessionStorage', () => {
    it('loads session when query matches session id in storage', async () => {
      const sessionSnap = { id: 'test-session-id', name: 'Test' }
      sessionStorage.setItem(
        'current',
        JSON.stringify({ session: sessionSnap }),
      )

      const loader = SessionLoader.create({
        sessionQuery: 'local-test-session-id',
        configSnapshot: {},
        initialTimestamp: Date.now(),
      })
      loader.setRuntimePlugins([])

      const result =
        await loader.fetchSessionFromSessionStorage('test-session-id')
      expect(result).toBe(true)
    })

    it('returns false when query does not match', async () => {
      const sessionSnap = { id: 'different-id', name: 'Test' }
      sessionStorage.setItem(
        'current',
        JSON.stringify({ session: sessionSnap }),
      )

      const loader = SessionLoader.create({
        initialTimestamp: Date.now(),
      })

      const result =
        await loader.fetchSessionFromSessionStorage('test-session-id')
      expect(result).toBe(false)
    })

    it('returns false when sessionStorage is empty', async () => {
      const loader = SessionLoader.create({
        initialTimestamp: Date.now(),
      })

      const result =
        await loader.fetchSessionFromSessionStorage('test-session-id')
      expect(result).toBe(false)
    })
  })

  describe('error getter', () => {
    it('returns configError when set', () => {
      const loader = SessionLoader.create({
        initialTimestamp: Date.now(),
      })
      const err = new Error('config error')
      loader.setConfigError(err)
      expect(loader.error).toBe(err)
    })

    it('returns sessionError when configError is not set', () => {
      const loader = SessionLoader.create({
        initialTimestamp: Date.now(),
      })
      const err = new Error('session error')
      loader.setSessionError(err)
      expect(loader.error).toBe(err)
    })

    it('returns configError over sessionError', () => {
      const loader = SessionLoader.create({
        initialTimestamp: Date.now(),
      })
      const configErr = new Error('config error')
      const sessionErr = new Error('session error')
      loader.setConfigError(configErr)
      loader.setSessionError(sessionErr)
      expect(loader.error).toBe(configErr)
    })
  })

  describe('snapshot serialization', () => {
    it('creates with minimal snapshot', () => {
      const loader = SessionLoader.create({
        initialTimestamp: 1234567890,
      })
      const snap = getSnapshot(loader)
      expect(snap.initialTimestamp).toBe(1234567890)
    })

    it('creates with full snapshot', () => {
      const loader = SessionLoader.create({
        configPath: '/path/to/config.json',
        sessionQuery: 'local-abc123',
        password: 'secret',
        adminKey: 'admin123',
        loc: 'chr1:1-1000',
        sessionTracks: '[]',
        assembly: 'hg38',
        tracks: 'track1',
        tracklist: true,
        highlight: 'chr1:100-200',
        nav: false,
        initialTimestamp: 1234567890,
        hubURL: ['https://example.com/hub.txt'],
        configSnapshot: { assemblies: [] },
        sessionSnapshot: { id: 'test' },
      })
      const snap = getSnapshot(loader)
      expect(snap.configPath).toBe('/path/to/config.json')
      expect(snap.sessionQuery).toBe('local-abc123')
      expect(snap.hubURL).toEqual(['https://example.com/hub.txt'])
    })
  })

  describe('config includes', () => {
    function mockConfigs(configs: Record<string, Record<string, unknown>>) {
      const { openLocation } = jest.requireMock('@jbrowse/core/util/io') as {
        openLocation: jest.Mock
      }
      openLocation.mockImplementation(({ uri }: { uri: string }) => {
        const url = new URL(uri, 'http://localhost/')
        const key = url.pathname.split('/').pop() ?? url.pathname
        return {
          readFile: jest.fn().mockResolvedValue(JSON.stringify(configs[key])),
        }
      })
    }

    async function waitForConfig(
      loader: ReturnType<typeof SessionLoader.create>,
    ) {
      for (let i = 0; i < 100; i++) {
        if (loader.isConfigLoaded) {
          return
        }
        // eslint-disable-next-line no-await-in-loop
        await new Promise(r => setTimeout(r, 10))
      }
      throw new Error('Timeout waiting for config to load')
    }

    it('merges a single included config', async () => {
      mockConfigs({
        'config.json': {
          configuration: {
            theme: { palette: { primary: { main: '#000000' } } },
          },
          includes: ['assembly.json'],
        },
        'assembly.json': {
          assemblies: [{ name: 'hg19' }],
          tracks: [{ trackId: 'genes', assemblyNames: ['hg19'] }],
        },
      })

      const loader = SessionLoader.create({
        initialTimestamp: Date.now(),
      })
      await waitForConfig(loader)

      expect(loader.configSnapshot).toEqual({
        configuration: {
          theme: { palette: { primary: { main: '#000000' } } },
        },
        assemblies: [{ name: 'hg19' }],
        tracks: [{ trackId: 'genes', assemblyNames: ['hg19'] }],
      })
    })

    it('merges multiple included configs and resolves duplicate IDs', async () => {
      mockConfigs({
        'config.json': {
          includes: ['a.json', 'b.json'],
        },
        'a.json': {
          tracks: [{ trackId: 't1', name: 'A' }],
          assemblies: [{ name: 'a' }],
        },
        'b.json': {
          tracks: [{ trackId: 't1', name: 'B' }],
          assemblies: [{ name: 'b' }],
        },
      })

      const loader = SessionLoader.create({
        initialTimestamp: Date.now(),
      })
      await waitForConfig(loader)

      expect(loader.configSnapshot?.tracks).toEqual([
        { trackId: 't1', name: 'A' },
      ])
      expect(loader.configSnapshot?.assemblies).toEqual([
        { name: 'a' },
        { name: 'b' },
      ])
    })

    it('supports recursive includes', async () => {
      mockConfigs({
        'config.json': {
          includes: ['a.json'],
        },
        'a.json': {
          includes: ['b.json'],
          assemblies: [{ name: 'a' }],
        },
        'b.json': {
          assemblies: [{ name: 'b' }],
        },
      })

      const loader = SessionLoader.create({
        initialTimestamp: Date.now(),
      })
      await waitForConfig(loader)

      expect(loader.configSnapshot?.assemblies).toEqual([
        { name: 'a' },
        { name: 'b' },
      ])
    })

    it('detects circular includes', async () => {
      mockConfigs({
        'config.json': {
          includes: ['a.json'],
        },
        'a.json': {
          includes: ['b.json'],
        },
        'b.json': {
          includes: ['a.json'],
        },
      })

      const loader = SessionLoader.create({
        initialTimestamp: Date.now(),
      })
      await waitForConfig(loader)

      expect(loader.configError).toBeTruthy()
      expect(String(loader.configError)).toContain(
        'Circular config include detected',
      )
    })
  })
})
