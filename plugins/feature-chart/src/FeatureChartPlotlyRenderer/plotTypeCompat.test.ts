import {
  isLegacyOnlyPlotType,
  plotTypeToSpec,
  resetPlotTypeDeprecationWarnings,
  warnPlotTypeDeprecated,
} from './plotTypeCompat.ts'

describe('plotType → spec alias', () => {
  test('box over grouped values', () => {
    const alias = plotTypeToSpec('box', {
      Brain: [1, 2, 3],
      Liver: [4, 5, 6],
    })
    expect(alias.spec).toEqual({
      specVersion: 1,
      kind: 'box',
      data: { form: 'grouped-values', path: '' },
    })
    expect(alias.error).toBeUndefined()
  })

  test('box over precomputed five-number summaries', () => {
    const alias = plotTypeToSpec('box', [
      { name: 'Brain', min: 1, q1: 2, median: 3, q3: 4, max: 5 },
    ])
    expect(alias.spec?.data.form).toBe('summary-stats')
  })

  test('violin over grouped values', () => {
    expect(plotTypeToSpec('violin', { Brain: [1, 2] }).spec).toMatchObject({
      kind: 'violin',
      data: { form: 'grouped-values' },
    })
  })

  test('bar over { name, value } entries', () => {
    expect(
      plotTypeToSpec('bar', [{ name: 'Brain', value: 1 }]).spec,
    ).toMatchObject({ kind: 'bar', data: { form: 'category-values' } })
  })

  test('bar over an object map of numbers', () => {
    const alias = plotTypeToSpec('bar', { Brain: 1, Liver: 2 })
    expect(alias.spec?.data.form).toBe('category-values')
    expect(alias.data).toEqual([
      { name: 'Brain', value: 1 },
      { name: 'Liver', value: 2 },
    ])
  })

  test('bar over grouped values keeps the legacy mean behaviour', () => {
    const alias = plotTypeToSpec('bar', { Brain: [1, 2, 3] })
    expect(alias.data).toEqual([{ name: 'Brain', value: 2 }])
  })

  test('summary stats are only legal for box', () => {
    const alias = plotTypeToSpec('violin', [
      { name: 'Brain', min: 1, q1: 2, median: 3, q3: 4, max: 5 },
    ])
    expect(alias.spec).toBeUndefined()
    expect(alias.error).toContain('summary-stats')
  })

  test('unwraps the wrapper keys the built-in drawers use', () => {
    // This is the shape `FeatureChartTabixAdapter` produces, i.e. what a legacy
    // Plotly config was pointed at.
    expect(
      plotTypeToSpec('box', { tissues: { Brain: [1, 2, 3] } }).spec,
    ).toEqual({
      specVersion: 1,
      kind: 'box',
      data: { form: 'grouped-values', path: '' },
    })
    expect(
      plotTypeToSpec('box', {
        boxes: [{ name: 'Brain', min: 1, q1: 2, median: 3, q3: 4, max: 5 }],
      }).spec?.data.form,
    ).toBe('summary-stats')
    expect(
      plotTypeToSpec('bar', { bars: [{ name: 'Brain', value: 1 }] }).spec?.data
        .form,
    ).toBe('category-values')
  })

  test('a single category named like a wrapper is not unwrapped', () => {
    const alias = plotTypeToSpec('box', { Brain: [1, 2, 3] })
    expect(alias.spec?.data.form).toBe('grouped-values')
    expect(alias.data).toEqual({ Brain: [1, 2, 3] })
  })

  test('an unrecognised payload explains itself', () => {
    const alias = plotTypeToSpec('box', 'nope')
    expect(alias.error).toContain('does not recognize this payload')
  })

  test('scatter/line are legacy-only and say so', () => {
    expect(isLegacyOnlyPlotType('scatter')).toBe(true)
    expect(isLegacyOnlyPlotType('box')).toBe(false)
    const alias = plotTypeToSpec('scatter', { x: [1], y: [2] })
    expect(alias.spec).toBeUndefined()
    expect(alias.error).toContain('no ChartModel')
  })
})

describe('deprecation warning', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})

  beforeEach(() => {
    warn.mockClear()
    resetPlotTypeDeprecationWarnings()
  })

  afterAll(() => {
    warn.mockRestore()
  })

  test('warns once per plotType, with the equivalent spec', () => {
    const spec = plotTypeToSpec('box', { Brain: [1] }).spec
    warnPlotTypeDeprecated('box', spec)
    warnPlotTypeDeprecated('box', spec)
    expect(warn).toHaveBeenCalledTimes(1)
    const message = warn.mock.calls[0]![0] as string
    expect(message).toContain('plotType "box" is deprecated')
    expect(message).toContain('"drawer": "spec"')
    expect(message).toContain('"kind":"box"')
  })

  test('a different plotType warns separately', () => {
    warnPlotTypeDeprecated('box', undefined)
    warnPlotTypeDeprecated('violin', undefined)
    expect(warn).toHaveBeenCalledTimes(2)
  })
})
