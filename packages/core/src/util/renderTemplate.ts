/**
 * Small dependency-free template renderer for user-facing text such as the
 * track info section of the "About this track" dialog.
 *
 * Only plain path lookups are supported (`{{track.name}}`,
 * `{{session.assemblies.0.name}}`, `{{track.adapter.type}}`). Expressions are
 * deliberately not supported here, use a `jexl:` prefixed config slot if you
 * need logic (the config slot evaluates the jexl expression and hands the
 * result to this function).
 */

export type TemplateContext = Record<string, unknown>

const variableRegex = /\{\{\s*([\w.-]+)\s*\}\}/g

/** warn about unknown variables only once per path, and only in dev */
const warnedPaths = new Set<string>()

function isDevelopment() {
  // `process` is not available in every runtime (webpack replaces
  // `process.env.NODE_ENV` statically at build time), so guard the access
  return typeof process !== 'undefined' && process.env.NODE_ENV !== 'production'
}

/**
 * Resolve a dotted path (e.g. `track.metadata.source`, `items.0.value`) in the
 * given context. Array indices are simply numeric path segments.
 *
 * @param context - object to look up the path in
 * @param path - dotted path, e.g. `assembly.displayName`
 * @returns the value, or undefined if any part of the path is missing
 */
export function resolveTemplatePath(
  context: TemplateContext,
  path: string,
): unknown {
  let value: unknown = context
  for (const part of path.split('.')) {
    if (value === null || typeof value !== 'object') {
      return undefined
    }
    // own properties only, template values are data and should not be able to
    // reach into e.g. Object.prototype or class internals
    if (!Object.hasOwn(value, part)) {
      return undefined
    }
    value = (value as Record<string, unknown>)[part]
  }
  return value
}

/**
 * Convert a resolved template value to its string representation. Missing
 * values render as an empty string, objects are rendered as JSON.
 */
export function stringifyTemplateValue(value: unknown): string {
  if (value === undefined || value === null) {
    return ''
  } else if (typeof value === 'string') {
    return value
  } else if (typeof value === 'object') {
    try {
      return JSON.stringify(value)
    } catch {
      return ''
    }
  }
  return String(value)
}

/**
 * Replace `{{path}}` placeholders in a template with values from the context.
 *
 * - unknown paths render as an empty string (and log a warning in dev) instead
 *   of throwing, so a typo in a config file never breaks the UI
 * - substituted values are not re-scanned for placeholders
 * - the context is never mutated
 *
 * @param template - template string
 * @param context - values to interpolate
 * @returns the rendered string
 */
export function renderTemplate(
  template: string,
  context: TemplateContext = {},
): string {
  if (typeof template !== 'string') {
    return ''
  }
  return template.replace(variableRegex, (_match, path: string) => {
    const value = resolveTemplatePath(context, path)
    if (value === undefined) {
      if (isDevelopment() && !warnedPaths.has(path)) {
        warnedPaths.add(path)
        console.warn(
          `renderTemplate: no value for template variable "{{${path}}}"`,
        )
      }
      return ''
    }
    return stringifyTemplateValue(value)
  })
}
