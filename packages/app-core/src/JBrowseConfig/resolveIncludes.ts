import { openLocation } from '@jbrowse/core/util/io'
import { addRelativeUris, dedupe } from '@jbrowse/core/util'

const arrayConfigFields = [
  'plugins',
  'assemblies',
  'tracks',
  'internetAccounts',
  'aggregateTextSearchAdapters',
  'connections',
  'preConfiguredSessions',
]

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function deepMerge(target: unknown, source: unknown): unknown {
  if (Array.isArray(target) && Array.isArray(source)) {
    return [...target, ...source]
  }
  if (isPlainObject(target) && isPlainObject(source)) {
    const result = { ...target }
    for (const key of Object.keys(source)) {
      result[key] = deepMerge(result[key], source[key])
    }
    return result
  }
  return source !== undefined ? source : target
}

function dedupeArrayField(field: string, arr: unknown[]): unknown[] {
  switch (field) {
    case 'assemblies':
      return dedupe(arr, a => (a as { name: string }).name)
    case 'tracks':
      return dedupe(arr, a => (a as { trackId: string }).trackId)
    case 'connections':
      return dedupe(
        arr,
        a =>
          (a as { connectionId?: string; name?: string }).connectionId ??
          (a as { connectionId?: string; name?: string }).name ??
          '',
      )
    case 'internetAccounts':
      return dedupe(
        arr,
        a => (a as { internetAccountId: string }).internetAccountId,
      )
    case 'plugins':
      return dedupe(
        arr,
        a =>
          `${(a as { name?: string }).name ?? ''}-${
            (
              a as {
                umdUrl?: string
                esmUrl?: string
                cjsUrl?: string
                url?: string
              }
            ).umdUrl ??
            (
              a as {
                umdUrl?: string
                esmUrl?: string
                cjsUrl?: string
                url?: string
              }
            ).esmUrl ??
            (
              a as {
                umdUrl?: string
                esmUrl?: string
                cjsUrl?: string
                url?: string
              }
            ).cjsUrl ??
            (
              a as {
                umdUrl?: string
                esmUrl?: string
                cjsUrl?: string
                url?: string
              }
            ).url ??
            ''
          }`,
      )
    default:
      return dedupe(arr)
  }
}

export function mergeConfigs(
  base: Record<string, unknown>,
  override: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = structuredClone(base)

  for (const key of Object.keys(override)) {
    const baseValue = result[key]
    const overrideValue = override[key]

    if (arrayConfigFields.includes(key)) {
      const combined = [
        ...(Array.isArray(baseValue) ? baseValue : []),
        ...(Array.isArray(overrideValue) ? overrideValue : []),
      ]
      result[key] = dedupeArrayField(key, combined)
    } else if (key === 'configuration' || key === 'defaultSession') {
      result[key] = deepMerge(baseValue, overrideValue)
    } else if (Array.isArray(baseValue) && Array.isArray(overrideValue)) {
      result[key] = [...baseValue, ...overrideValue]
    } else if (isPlainObject(baseValue) && isPlainObject(overrideValue)) {
      result[key] = deepMerge(baseValue, overrideValue)
    } else {
      result[key] = overrideValue
    }
  }

  return result
}

async function collectIncludedConfigs(
  config: Record<string, unknown>,
  baseUri: URL,
  visited: Set<string>,
  cache: Map<string, Record<string, unknown>>,
): Promise<Record<string, unknown>[]> {
  const baseHref = baseUri.href

  if (visited.has(baseHref)) {
    throw new Error(`Circular config include detected: ${baseHref}`)
  }
  visited.add(baseHref)

  const includes = config.includes
  if (
    includes !== undefined &&
    (!Array.isArray(includes) || !includes.every(i => typeof i === 'string'))
  ) {
    throw new Error(
      `Invalid "includes" field in config ${baseHref}: expected an array of strings`,
    )
  }

  const configWithoutIncludes = { ...config }
  delete configWithoutIncludes.includes

  const result: Record<string, unknown>[] = [configWithoutIncludes]

  if (Array.isArray(includes)) {
    for (const includePath of includes) {
      const includeUri = new URL(includePath, baseUri)
      let resolved = cache.get(includeUri.href)
      if (resolved) {
        resolved = structuredClone(resolved)
      } else {
        const text = await openLocation({
          uri: includeUri.href,
          locationType: 'UriLocation',
        }).readFile('utf8')
        const includedConfig = JSON.parse(text)
        addRelativeUris(includedConfig, includeUri)
        const childConfigs = await collectIncludedConfigs(
          includedConfig,
          includeUri,
          visited,
          cache,
        )
        resolved = childConfigs.reduce(
          (merged, cfg) => mergeConfigs(merged, cfg),
          {},
        )
        cache.set(includeUri.href, resolved)
      }
      result.push(resolved)
    }
  }

  visited.delete(baseHref)

  return result
}

export async function resolveIncludes(
  config: Record<string, unknown>,
  baseUri: URL,
  visited: Set<string> = new Set(),
  cache: Map<string, Record<string, unknown>> = new Map(),
): Promise<Record<string, unknown>> {
  const configs = await collectIncludedConfigs(config, baseUri, visited, cache)
  return configs.reduce((merged, cfg) => mergeConfigs(merged, cfg), {})
}
