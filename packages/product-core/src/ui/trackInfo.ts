import { readConfObject } from '@jbrowse/core/configuration'
import { stringToJexlExpression } from '@jbrowse/core/util/jexlStrings'
import { renderTemplate } from '@jbrowse/core/util/renderTemplate'
import { isStateTreeNode } from '@jbrowse/mobx-state-tree'

import { generateDisplayableConfig, readConf, removeAttr } from './util.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { AbstractSessionModel } from '@jbrowse/core/util'

type ConfigModel = AnyConfigurationModel | Record<string, unknown>

/**
 * Namespace describing a single assembly, see
 * [extension points](../docs/developer_guides/extension_points.md)
 */
export interface TrackInfoAssembly {
  name: string
  displayName?: string
  aliases?: string[]
}

/** Namespace describing the track itself */
export interface TrackInfoTrack {
  trackId?: string
  name?: string
  type?: string
  description?: string
  category?: unknown
  metadata: Record<string, unknown>
  adapter?: Record<string, unknown>
  assemblyNames: string[]
}

/** Values that are available to `formatAbout.info` templates */
export interface TrackInfoContext {
  track: TrackInfoTrack
  config: Record<string, unknown>
  assembly?: TrackInfoAssembly
  session: {
    assemblyNames: string[]
    assemblies: TrackInfoAssembly[]
  }
  [namespace: string]: unknown
}

export interface ResolvedTrackInfo {
  /** rendered markdown, empty string when no template is configured */
  info: string
  /** whether the "Track info" panel should be shown */
  visible: boolean
  /** whether local URIs should be hidden in the about dialog */
  hideUris: boolean
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readField(obj: unknown, key: string): unknown {
  try {
    if (obj && typeof obj === 'object') {
      return (obj as Record<string, unknown>)[key]
    }
  } catch {
    // MST models can throw when read in a detached state
  }
  return undefined
}

function getAssemblyInfo(
  session: AbstractSessionModel,
  assemblyName: string,
): TrackInfoAssembly | undefined {
  if (!assemblyName) {
    return undefined
  }

  // the assembly manager also resolves aliases to the canonical assembly
  const assemblyManager = readField(session, 'assemblyManager') as
    | { get?: (name: string) => unknown }
    | undefined
  if (typeof assemblyManager?.get === 'function') {
    try {
      const assembly = assemblyManager.get(assemblyName)
      if (assembly) {
        return toAssemblyInfo(assembly, assemblyName)
      }
    } catch {
      // fall through to the session assembly config list
    }
  }

  const assemblies = readField(session, 'assemblies')
  if (Array.isArray(assemblies)) {
    const match = assemblies.find(assembly => {
      const name = readConf(assembly as ConfigModel, ['name'])
      const aliases = readConf(assembly as ConfigModel, ['aliases'])
      return (
        name === assemblyName ||
        (Array.isArray(aliases) && aliases.includes(assemblyName))
      )
    })
    if (match) {
      return toAssemblyInfo(match, assemblyName)
    }
  }

  return { name: assemblyName }
}

function toAssemblyInfo(
  assembly: unknown,
  fallbackName: string,
): TrackInfoAssembly {
  const name = readField(assembly, 'name')
  const displayName = readField(assembly, 'displayName')
  const aliases = readField(assembly, 'aliases')
  return {
    name: typeof name === 'string' ? name : fallbackName,
    displayName: typeof displayName === 'string' ? displayName : undefined,
    aliases: Array.isArray(aliases) ? aliases : undefined,
  }
}

/**
 * Read a config slot from either an MST config model or a plain config object.
 * MST config slots evaluate `jexl:` values themselves, plain objects need to be
 * evaluated here with the same arguments.
 */
function readSlot(
  config: ConfigModel | undefined,
  slotPath: string[],
  args: Record<string, unknown>,
  pluginManager: PluginManager,
) {
  if (!config) {
    return undefined
  }
  if (isStateTreeNode(config)) {
    return readConf(config, slotPath, args)
  }
  const value = readConf(config, slotPath)
  if (typeof value === 'string' && value.startsWith('jexl:')) {
    try {
      return stringToJexlExpression(value, pluginManager.jexl).eval(args)
    } catch (e) {
      console.warn(`failed to evaluate ${slotPath.join('.')}`, e)
      return undefined
    }
  }
  return value
}

function buildTrackNamespace(trackConfig: Record<string, unknown>) {
  const adapter = trackConfig.adapter
  const metadata = trackConfig.metadata
  const assemblyNames = trackConfig.assemblyNames
  return {
    trackId: trackConfig.trackId,
    name: trackConfig.name,
    type: trackConfig.type,
    description: trackConfig.description,
    category: trackConfig.category,
    metadata: isPlainObject(metadata) ? metadata : {},
    adapter: isPlainObject(adapter) ? adapter : undefined,
    assemblyNames: Array.isArray(assemblyNames) ? assemblyNames : [],
  } as TrackInfoTrack
}

/**
 * Build the values that are available to `formatAbout.info` templates.
 *
 * Plugins can add their own namespaces (e.g. `{{feature.*}}`) with the
 * `Core-trackInfoContext` extension point. Core namespaces win on conflict.
 */
export function buildTrackInfoContext({
  config,
  session,
  pluginManager,
  hideUris,
}: {
  config: ConfigModel
  session: AbstractSessionModel
  pluginManager: PluginManager
  hideUris: boolean
}): TrackInfoContext {
  const trackConfig = isStateTreeNode(config)
    ? (readConfObject(config) as Record<string, unknown>)
    : config

  const track = buildTrackNamespace(trackConfig)

  const assemblyNames = session.assemblyNames
  const firstAssemblyName = track.assemblyNames[0] ?? assemblyNames[0]
  const assembly = firstAssemblyName
    ? getAssemblyInfo(session, firstAssemblyName)
    : undefined

  const displayableConfig = structuredClone(
    generateDisplayableConfig({ config, session, pluginManager }).config,
  )
  if (hideUris) {
    removeAttr(displayableConfig, 'baseUri')
    removeAttr(displayableConfig, 'uri')
  }

  const coreContext = {
    track,
    config: displayableConfig,
    assembly,
    session: {
      assemblyNames,
      assemblies: assemblyNames.map(
        name => getAssemblyInfo(session, name) ?? { name },
      ),
    },
  }

  const extensions = pluginManager.evaluateExtensionPoint(
    'Core-trackInfoContext',
    {},
    { session, config, pluginManager, context: coreContext },
  )
  return {
    ...(isPlainObject(extensions) ? extensions : {}),
    ...coreContext,
  } as TrackInfoContext
}

/**
 * Resolve the markdown info that should be displayed in the "About this track"
 * dialog.
 *
 * - a track with a non-empty `formatAbout.info` uses that template, tracks
 *   without one fall back to the root `configuration.formatAbout.info`
 * - `formatAbout.showInfo: false` on either the track or the root hides the
 *   panel entirely
 * - `jexl:` prefixed templates are evaluated first, the result is then
 *   rendered as a `{{path}}` template
 * - `formatAbout.hideUris` (track or root) hides local URIs
 */
export function resolveTrackInfo(
  config: ConfigModel,
  session: AbstractSessionModel,
  pluginManager: PluginManager,
): ResolvedTrackInfo {
  const rootConfig = readField(session, 'configuration') as ConfigModel

  const hideUris = Boolean(
    readSlot(rootConfig, ['formatAbout', 'hideUris'], {}, pluginManager) ||
    readSlot(config, ['formatAbout', 'hideUris'], {}, pluginManager),
  )

  const context = buildTrackInfoContext({
    config,
    session,
    pluginManager,
    hideUris,
  })

  const trackTemplate = readSlot(
    config,
    ['formatAbout', 'info'],
    context,
    pluginManager,
  )
  const rootTemplate = readSlot(
    rootConfig,
    ['formatAbout', 'info'],
    context,
    pluginManager,
  )

  // a track template wins over the site wide default, whitespace only counts as
  // "not configured"
  const template =
    typeof trackTemplate === 'string' && trackTemplate.trim() !== ''
      ? trackTemplate
      : typeof rootTemplate === 'string'
        ? rootTemplate
        : ''

  const info = renderTemplate(template, context)

  const trackShowsInfo = readSlot(
    config,
    ['formatAbout', 'showInfo'],
    context,
    pluginManager,
  )
  const rootShowsInfo = readSlot(
    rootConfig,
    ['formatAbout', 'showInfo'],
    context,
    pluginManager,
  )

  return {
    info,
    visible:
      trackShowsInfo !== false && rootShowsInfo !== false && info.trim() !== '',
    hideUris,
  }
}
