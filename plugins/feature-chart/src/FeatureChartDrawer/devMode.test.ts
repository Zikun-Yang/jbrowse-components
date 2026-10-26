import { isDevelopmentBuild } from './devMode.ts'

describe('isDevelopmentBuild', () => {
  const originalNodeEnv = process.env.NODE_ENV

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv
  })

  test('is true for a non-production build', () => {
    process.env.NODE_ENV = 'development'
    expect(isDevelopmentBuild()).toBe(true)
    process.env.NODE_ENV = 'test'
    expect(isDevelopmentBuild()).toBe(true)
  })

  test('is false when the bundler substituted "production"', () => {
    process.env.NODE_ENV = 'production'
    expect(isDevelopmentBuild()).toBe(false)
  })

  // The regression this guards: webpack substitutes `process.env.NODE_ENV` at
  // build time but does not polyfill `process`, so a `typeof process` guard made
  // every development warning dead code in the browser.
  test('treats a runtime without `process` as a development build', () => {
    const originalProcess = globalThis.process
    // @ts-expect-error - simulating a browser bundle without a `process` shim
    delete globalThis.process
    try {
      expect(isDevelopmentBuild()).toBe(true)
    } finally {
      globalThis.process = originalProcess
    }
  })
})
