import {
  DEFAULT_COLOR_SCHEME,
  listColorSchemeNames,
  resolveColorScheme,
} from './colorSchemes.ts'

describe('feature chart color schemes', () => {
  test('exposes the documented palettes', () => {
    expect(listColorSchemeNames()).toEqual([
      'blues',
      'dark2',
      'set2',
      'tableau10',
      'viridis',
    ])
  })

  test('every palette is a hex palette usable for alpha fills', () => {
    for (const name of listColorSchemeNames()) {
      const scheme = resolveColorScheme({}, name)
      expect(scheme.name).toBe(name)
      expect(scheme.colors.length).toBeGreaterThanOrEqual(8)
      for (const color of scheme.colors) {
        // drawers append '33' for a 20% fill, which requires #rrggbb
        expect(color).toMatch(/^#[\da-f]{6}$/)
      }
    }
  })

  test('defaults to tableau10', () => {
    expect(resolveColorScheme(undefined, undefined).name).toBe(
      DEFAULT_COLOR_SCHEME,
    )
    expect(resolveColorScheme(null, null).name).toBe('tableau10')
  })

  test('unknown schemes fall back to the default and warn only once', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})

    expect(resolveColorScheme({}, 'notAPalette').name).toBe(
      DEFAULT_COLOR_SCHEME,
    )
    expect(resolveColorScheme({}, 'notAPalette').name).toBe(
      DEFAULT_COLOR_SCHEME,
    )
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]![0]).toContain('notAPalette')

    warn.mockRestore()
  })

  test('dark theme flips panel chrome and lightens the palette', () => {
    const light = resolveColorScheme({ palette: { mode: 'light' } }, 'viridis')
    const dark = resolveColorScheme({ palette: { mode: 'dark' } }, 'viridis')

    expect(dark.background).not.toBe(light.background)
    expect(dark.text).not.toBe(light.text)
    // viridis starts near-black; on a dark panel it must be lightened
    expect(dark.colors[0]).not.toBe(light.colors[0])
    expect(dark.colors.every(color => /^#[\da-f]{6}$/.test(color))).toBe(true)
  })
})
