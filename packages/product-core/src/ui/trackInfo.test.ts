import PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import TrackType from '@jbrowse/core/pluggableElementTypes/TrackType'
import {
  createBaseTrackConfig,
  createBaseTrackModel,
} from '@jbrowse/core/pluggableElementTypes/models'
import { getSnapshot, types } from '@jbrowse/mobx-state-tree'

import { buildTrackInfoContext, resolveTrackInfo } from './trackInfo.ts'
import { readConf } from './util.ts'

import type { AbstractSessionModel } from '@jbrowse/core/util'

function initializePluginManager() {
  const pluginManager = new PluginManager()
  pluginManager.addTrackType(() => {
    const configSchema = ConfigurationSchema(
      'TestTrack',
      {},
      {
        baseConfiguration: createBaseTrackConfig(pluginManager),
        explicitIdentifier: 'trackId',
      },
    )
    return new TrackType({
      name: 'TestTrack',
      configSchema,
      stateModel: createBaseTrackModel(
        pluginManager,
        'TestTrack',
        configSchema,
      ),
    })
  })
  pluginManager.createPluggableElements()
  pluginManager.configure()
  return pluginManager
}

const pluginManager = initializePluginManager()

const assemblyManager = {
  get(name: string) {
    return name === 'hg38' || name === 'GRCh38'
      ? {
          name: 'hg38',
          displayName: 'Human (GRCh38)',
          aliases: ['GRCh38', 'hg38'],
        }
      : undefined
  },
}

function makeSession(
  configuration: Record<string, unknown> = {},
  assemblyNames = ['hg38'],
) {
  return {
    configuration,
    assemblyNames,
    assemblies: [],
    assemblyManager,
  } as unknown as AbstractSessionModel
}

function makeTrackConfig(snapshot: Record<string, unknown>) {
  const configSchema = pluginManager.getTrackType('TestTrack')!.configSchema
  const container = types.model({ configuration: configSchema })
  return container.create(
    {
      configuration: {
        trackId: 'tissue_expression',
        name: 'Tissue expression',
        type: 'TestTrack',
        assemblyNames: ['hg38'],
        metadata: { source: 'GEO' },
        ...snapshot,
      },
    },
    { pluginManager },
  ).configuration
}

function makePlainTrackConfig(snapshot: Record<string, unknown>) {
  return {
    trackId: 'tissue_expression',
    name: 'Tissue expression',
    type: 'TestTrack',
    assemblyNames: ['hg38'],
    metadata: { source: 'GEO' },
    adapter: { type: 'CramAdapter' },
    ...snapshot,
  }
}

describe('resolveTrackInfo inheritance', () => {
  test('uses the track info when it is set', () => {
    const config = makeTrackConfig({
      formatAbout: { info: 'track info' },
    })
    const session = makeSession({ formatAbout: { info: 'root info' } })
    expect(resolveTrackInfo(config, session, pluginManager)).toMatchObject({
      info: 'track info',
      visible: true,
    })
  })

  test('falls back to the root info when the track has none', () => {
    const config = makeTrackConfig({})
    const session = makeSession({ formatAbout: { info: 'root info' } })
    expect(resolveTrackInfo(config, session, pluginManager)).toMatchObject({
      info: 'root info',
      visible: true,
    })
  })

  test('whitespace only track info falls back to the root info', () => {
    const config = makeTrackConfig({ formatAbout: { info: '   \n  ' } })
    const session = makeSession({ formatAbout: { info: 'root info' } })
    expect(resolveTrackInfo(config, session, pluginManager).info).toBe(
      'root info',
    )
  })

  test('is not visible without any template', () => {
    const config = makeTrackConfig({})
    const session = makeSession()
    expect(resolveTrackInfo(config, session, pluginManager)).toMatchObject({
      info: '',
      visible: false,
    })
  })

  test('showInfo false on the track hides it', () => {
    const config = makeTrackConfig({
      formatAbout: { info: 'track info', showInfo: false },
    })
    const session = makeSession({ formatAbout: { info: 'root info' } })
    expect(resolveTrackInfo(config, session, pluginManager).visible).toBe(false)
  })

  test('showInfo false on the root hides it for every track', () => {
    const config = makeTrackConfig({ formatAbout: { info: 'track info' } })
    const session = makeSession({ formatAbout: { showInfo: false } })
    expect(resolveTrackInfo(config, session, pluginManager).visible).toBe(false)
  })

  test('showInfo true on the track cannot override the root', () => {
    const config = makeTrackConfig({
      formatAbout: { info: 'track info', showInfo: true },
    })
    const session = makeSession({ formatAbout: { showInfo: false } })
    expect(resolveTrackInfo(config, session, pluginManager).visible).toBe(false)
  })

  test('works with a plain object config', () => {
    const config = makePlainTrackConfig({ formatAbout: { info: 'plain' } })
    expect(resolveTrackInfo(config, makeSession(), pluginManager).info).toBe(
      'plain',
    )
  })
})

describe('resolveTrackInfo template context', () => {
  test('interpolates track, assembly and session values', () => {
    const config = makePlainTrackConfig({
      formatAbout: {
        info: [
          '**{{track.name}}**',
          'source `{{track.metadata.source}}`',
          'adapter `{{track.adapter.type}}`',
          'assembly `{{assembly.displayName}}`',
          'first assembly `{{session.assemblies.0.name}}`',
          'trackId `{{track.trackId}}`',
        ].join('\n\n'),
      },
    })
    const session = makeSession()
    expect(resolveTrackInfo(config, session, pluginManager).info)
      .toBe(`**Tissue expression**

source \`GEO\`

adapter \`CramAdapter\`

assembly \`Human (GRCh38)\`

first assembly \`hg38\`

trackId \`tissue_expression\``)
  })

  test('exposes the displayable config', () => {
    const config = makePlainTrackConfig({
      formatAbout: {
        info: '{{config.adapter.type}}',
        config: { adapter: { type: 'OverriddenAdapter' } },
      },
    })
    expect(resolveTrackInfo(config, makeSession(), pluginManager).info).toBe(
      'OverriddenAdapter',
    )
  })

  test('hides uris in the config namespace when hideUris is set', () => {
    const config = makePlainTrackConfig({
      adapter: {
        type: 'BamAdapter',
        uri: '/secret/path.bam',
        baseUri: '/secret',
      },
      formatAbout: { info: '{{config.adapter.uri}}', hideUris: true },
    })
    const context = buildTrackInfoContext({
      config,
      session: makeSession(),
      pluginManager,
      hideUris: true,
    })
    expect(context.config.adapter).toStrictEqual({ type: 'BamAdapter' })
    expect(resolveTrackInfo(config, makeSession(), pluginManager).info).toBe('')
  })

  test('keeps uris in the config namespace when hideUris is not set', () => {
    const config = makePlainTrackConfig({
      adapter: { type: 'BamAdapter', uri: '/data/path.bam' },
      formatAbout: { info: '{{config.adapter.uri}}' },
    })
    expect(resolveTrackInfo(config, makeSession(), pluginManager).info).toBe(
      '/data/path.bam',
    )
  })

  test('hideUris is inherited from the root', () => {
    const config = makeTrackConfig({ formatAbout: { info: 'x' } })
    const session = makeSession({ formatAbout: { hideUris: true } })
    expect(resolveTrackInfo(config, session, pluginManager).hideUris).toBe(true)
  })

  test('hideUris works with a plain object config', () => {
    const config = makePlainTrackConfig({ formatAbout: { hideUris: true } })
    expect(
      resolveTrackInfo(config, makeSession(), pluginManager).hideUris,
    ).toBe(true)
  })

  test('missing values render as empty string', () => {
    const config = makeTrackConfig({
      formatAbout: { info: '[{{track.missing.deep}}]' },
    })
    expect(resolveTrackInfo(config, makeSession(), pluginManager).info).toBe(
      '[]',
    )
  })
})

describe('resolveTrackInfo jexl', () => {
  test('evaluates a jexl template in the track config', () => {
    const config = makeTrackConfig({
      formatAbout: { info: 'jexl:`## ${track.name}`' },
    })
    expect(resolveTrackInfo(config, makeSession(), pluginManager).info).toBe(
      '## Tissue expression',
    )
  })

  test('evaluates jexl and renders {{}} in the returned string', () => {
    const config = makeTrackConfig({
      formatAbout: {
        info: `jexl:'**' + track.name + '** ' + '{{track.metadata.source}}'`,
      },
    })
    expect(resolveTrackInfo(config, makeSession(), pluginManager).info).toBe(
      '**Tissue expression** GEO',
    )
  })

  test('evaluates a jexl template in the root config', () => {
    const config = makeTrackConfig({})
    const session = makeSession({
      formatAbout: { info: `jexl:'site ' + session.assemblies[0].name` },
    })
    expect(resolveTrackInfo(config, session, pluginManager).info).toBe(
      'site hg38',
    )
  })

  test('evaluates jexl in a plain object config', () => {
    const config = makePlainTrackConfig({
      formatAbout: { info: `jexl:track.name` },
    })
    expect(resolveTrackInfo(config, makeSession(), pluginManager).info).toBe(
      'Tissue expression',
    )
  })

  test('a failing jexl expression does not throw', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const config = makePlainTrackConfig({
      formatAbout: { info: 'jexl:this.is.not.()valid' },
    })
    expect(resolveTrackInfo(config, makeSession(), pluginManager).info).toBe('')
    warn.mockRestore()
  })
})

describe('resolveTrackInfo extension point', () => {
  test('plugins can add their own namespaces', () => {
    const extensionManager = initializePluginManager()
    extensionManager.addToExtensionPoint(
      'Core-trackInfoContext',
      (context: Record<string, unknown>, props: any) => ({
        ...context,
        custom: { value: `custom-${props.config.trackId}` },
      }),
    )
    const config = makePlainTrackConfig({
      formatAbout: { info: '{{custom.value}} {{track.name}}' },
    })
    expect(resolveTrackInfo(config, makeSession(), extensionManager).info).toBe(
      'custom-tissue_expression Tissue expression',
    )
  })

  test('core namespaces win over plugin namespaces', () => {
    const extensionManager = initializePluginManager()
    extensionManager.addToExtensionPoint('Core-trackInfoContext', () => ({
      track: { name: 'hijacked' },
    }))
    const config = makePlainTrackConfig({
      formatAbout: { info: '{{track.name}}' },
    })
    expect(resolveTrackInfo(config, makeSession(), extensionManager).info).toBe(
      'Tissue expression',
    )
  })
})

describe('buildTrackInfoContext', () => {
  test('builds the documented namespaces', () => {
    const config = makeTrackConfig({})
    const context = buildTrackInfoContext({
      config,
      session: makeSession(),
      pluginManager,
      hideUris: false,
    })
    expect(context.track).toMatchObject({
      trackId: 'tissue_expression',
      name: 'Tissue expression',
      type: 'TestTrack',
      metadata: { source: 'GEO' },
      assemblyNames: ['hg38'],
    })
    expect(context.assembly).toMatchObject({
      name: 'hg38',
      displayName: 'Human (GRCh38)',
    })
    expect(context.session.assemblyNames).toStrictEqual(['hg38'])
    expect(context.session.assemblies).toStrictEqual([
      {
        name: 'hg38',
        displayName: 'Human (GRCh38)',
        aliases: ['GRCh38', 'hg38'],
      },
    ])
  })

  test('resolves assembly aliases', () => {
    const config = makeTrackConfig({ assemblyNames: ['GRCh38'] })
    const context = buildTrackInfoContext({
      config,
      session: makeSession({}, []),
      pluginManager,
      hideUris: false,
    })
    expect(context.assembly).toMatchObject({ name: 'hg38' })
  })

  test('falls back to the session assembly list', () => {
    const config = makePlainTrackConfig({ assemblyNames: ['mm10'] })
    const session = {
      configuration: {},
      assemblyNames: ['mm10'],
      assemblies: [{ name: 'mm10', displayName: 'Mouse (GRCm38)' }],
    } as unknown as AbstractSessionModel
    const context = buildTrackInfoContext({
      config,
      session,
      pluginManager,
      hideUris: false,
    })
    expect(context.assembly).toMatchObject({
      name: 'mm10',
      displayName: 'Mouse (GRCm38)',
    })
  })
})

describe('formatAbout config snapshot', () => {
  test('defaults are omitted from the track config snapshot', () => {
    const config = makeTrackConfig({})
    const snapshot = getSnapshot(config) as {
      formatAbout?: Record<string, unknown>
    }
    expect(readConf(config, ['formatAbout', 'info'])).toBe('')
    expect(readConf(config, ['formatAbout', 'showInfo'])).toBe(true)
    // defaults must not end up in exported sessions
    expect(snapshot.formatAbout?.info).toBeUndefined()
    expect(snapshot.formatAbout?.showInfo).toBeUndefined()
  })

  test('a configured info slot survives an export/import round trip', () => {
    const config = makeTrackConfig({
      formatAbout: { info: '## version {{track.name}}', showInfo: false },
    })
    const snapshot = getSnapshot(config)
    const container = types.model({
      configuration: pluginManager.getTrackType('TestTrack')!.configSchema,
    })
    const restored = container.create(
      { configuration: snapshot },
      { pluginManager },
    ).configuration
    expect(readConf(restored, ['formatAbout', 'info'])).toBe(
      '## version {{track.name}}',
    )
    expect(readConf(restored, ['formatAbout', 'showInfo'])).toBe(false)
  })

  test('jexl info evaluates with the track info context variables', () => {
    const config = makeTrackConfig({
      formatAbout: { info: 'jexl:`## ${track.name}`' },
    })
    // contextVariable names that the slot advertises are used as jexl variables
    expect(
      readConf(config, ['formatAbout', 'info'], {
        track: { name: 'From jexl' },
      }),
    ).toBe('## From jexl')
    expect(resolveTrackInfo(config, makeSession(), pluginManager).info).toBe(
      '## Tissue expression',
    )
  })
})
