/**
 * URL whitelist for the markdown panel.
 *
 * Only `http:`, `https:`, `mailto:`, fragment links (`#...`) and relative paths
 * are allowed. Everything else (notably `javascript:` and `data:`) is dropped.
 * When `hideUris` is set, local relative paths are dropped as well.
 */

const allowedProtocols = new Set(['http', 'https', 'mailto'])

// control characters can be used to smuggle a scheme past na(t)ive checks
// eslint-disable-next-line no-control-regex
const controlCharacters = /[\u0000-\u001F\u007F]/

/**
 * @param url - url found in the markdown source
 * @param hideUris - whether local (relative) links should be dropped
 * @returns a safe url, or an empty string if the url is not allowed
 */
export function safeUrlTransform(url: string, hideUris = false): string {
  const value = String(url).trim()
  if (!value || controlCharacters.test(value)) {
    return ''
  }

  // pure fragment link
  if (value.startsWith('#')) {
    return value
  }

  // protocol relative url, resolves to http(s) at load time
  if (value.startsWith('//')) {
    return value
  }

  const protocolMatch = /^([a-z][a-z0-9+.-]*):/i.exec(value)
  if (protocolMatch) {
    const protocol = protocolMatch[1]!.toLowerCase()
    return allowedProtocols.has(protocol) ? value : ''
  }

  // relative path, these are local files and are hidden together with the rest
  // of the uri information
  return hideUris ? '' : value
}
