/**
 * Development-build detection for this plugin's one-time console warnings.
 *
 * JBrowse is bundled by webpack, whose `mode` injects a `DefinePlugin` entry
 * that substitutes **`process.env.NODE_ENV`** with a string literal at build
 * time. It does *not* polyfill `process` itself, so in a browser bundle
 * `typeof process === 'undefined'` is true while `process.env.NODE_ENV` has
 * already been replaced by the literal — a guard such as
 *
 * ```ts
 * typeof process !== 'undefined' && process.env.NODE_ENV !== 'production'
 * ```
 *
 * therefore short-circuits to `false` and silently disables every warning in
 * exactly the builds where they are wanted (verified in a real dev server: the
 * bundle contains no `process.env.NODE_ENV`, yet the page has no `process`).
 *
 * Read the expression directly and fall back to "not production" when the
 * runtime has neither the substitution nor `process`: warning on an unknown
 * environment is better than staying silent in development, and a production
 * bundle always carries the substituted `"production"`.
 */
export function isDevelopmentBuild(): boolean {
  try {
    return process.env.NODE_ENV !== 'production'
  } catch {
    return true
  }
}
