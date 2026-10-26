import type { FeatureChartDrawerError } from './drawerRegistry.ts'

/**
 * Human-readable rendering of a drawer lookup failure, shared by the canvas
 * placeholder and the maximize dialog so both always say the same thing.
 */
export interface FeatureChartDrawerErrorMessage {
  /** Short reason: the placeholder headline and the dialog summary. */
  title: string
  /** Actionable follow-up: missing plugin, typo suggestions, next step. */
  hint?: string
  /** `Available: a, b, c` (truncated to the first few names). */
  available: string
}

const MAX_AVAILABLE_NAMES = 5

function formatSuggestions(suggestions: string[] | undefined) {
  if (!suggestions || suggestions.length === 0) {
    return undefined
  }
  const quoted = suggestions.map(name => `"${name}"`).join(', ')
  return suggestions.length === 1
    ? `Did you mean ${quoted}?`
    : `Did you mean one of ${quoted}?`
}

/**
 * Compose the two-part message.
 *
 * The important distinction is the one a user hits in practice: a
 * `pluginName/drawerName` drawer that is *not* registered because its plugin
 * was never loaded ("missing plugin", fixable by editing `config.plugins`) vs.
 * a plain typo in an otherwise working install.
 */
export function describeFeatureChartDrawerError(
  error: FeatureChartDrawerError,
): FeatureChartDrawerErrorMessage {
  const suggestions = formatSuggestions(error.suggestions)

  let hint: string | undefined
  if (error.missingPlugin !== undefined && error.pluginLoaded === true) {
    hint =
      `Plugin "${error.missingPlugin}" is loaded but does not provide this drawer — ` +
      'check listFeatureChartDrawers() for the names it registers.'
  } else if (error.missingPlugin !== undefined) {
    hint =
      `Missing plugin? Drawers named "plugin/drawer" come from a plugin: ` +
      `add "${error.missingPlugin}" to config.plugins and reload the page.`
  }

  if (suggestions) {
    hint = hint ? `${hint} ${suggestions}` : suggestions
  }

  const names = error.available.slice(0, MAX_AVAILABLE_NAMES)
  const extra = error.available.length - names.length
  const available =
    names.length === 0
      ? 'No drawers are registered'
      : `Available: ${names.join(', ')}${extra > 0 ? ` (+${extra} more)` : ''}`

  return {
    title: error.error,
    ...(hint === undefined ? {} : { hint }),
    available,
  }
}

/** One dialog-ready sentence: what failed, why, and what to try next. */
export function formatFeatureChartDrawerError(
  error: FeatureChartDrawerError,
): string {
  const { title, hint, available } = describeFeatureChartDrawerError(error)
  return [title, hint, available].filter(Boolean).join(' ')
}
