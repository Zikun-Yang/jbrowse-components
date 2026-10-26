import {
  findUnknownDrawerOptions,
  getDrawerOptionKeys,
  warnUnknownDrawerOptions,
} from './drawerOptions.ts'

describe('getDrawerOptionKeys', () => {
  test('object schemas expose their keys', () => {
    expect(
      getDrawerOptionKeys({
        optionsSchema: { colorRamp: 'cool | warm', cellGap: 'px, 0-6' },
      }),
    ).toEqual(['colorRamp', 'cellGap'])
  })

  test('array schemas expose their entries and drop non-strings', () => {
    expect(
      getDrawerOptionKeys({ optionsSchema: ['colorRamp', 7, '', 'cellGap'] }),
    ).toEqual(['colorRamp', 'cellGap'])
  })

  test('an empty schema means "reads no options"', () => {
    expect(getDrawerOptionKeys({ optionsSchema: {} })).toEqual([])
    expect(getDrawerOptionKeys({ optionsSchema: [] })).toEqual([])
  })

  test('no schema at all means "undeclared" (undefined, not empty)', () => {
    expect(getDrawerOptionKeys({})).toBeUndefined()
    expect(getDrawerOptionKeys({ optionsSchema: undefined })).toBeUndefined()
    expect(
      getDrawerOptionKeys({ optionsSchema: 'not a schema' }),
    ).toBeUndefined()
    expect(getDrawerOptionKeys(null)).toBeUndefined()
    expect(getDrawerOptionKeys(undefined)).toBeUndefined()
  })
})

describe('findUnknownDrawerOptions', () => {
  const meta = {
    name: 'myPlugin/heatmap',
    optionsSchema: { colorRamp: 'cool | warm', cellGap: 'px' },
  }

  test('reports the keys the drawer does not declare, sorted', () => {
    expect(
      findUnknownDrawerOptions(meta, { cellGap: 2, colorRamp: 'warm' }),
    ).toEqual([])
    expect(
      findUnknownDrawerOptions(meta, { zeta: 1, alpha: 2, cellGap: 2 }),
    ).toEqual(['alpha', 'zeta'])
  })

  test('an empty schema makes every key unknown', () => {
    expect(findUnknownDrawerOptions({ optionsSchema: {} }, { a: 1 })).toEqual([
      'a',
    ])
  })

  test('undeclared schemas and missing/odd options report nothing', () => {
    expect(findUnknownDrawerOptions({}, { a: 1 })).toEqual([])
    expect(findUnknownDrawerOptions(meta, undefined)).toEqual([])
    expect(findUnknownDrawerOptions(meta, null)).toEqual([])
    expect(findUnknownDrawerOptions(meta, {})).toEqual([])
    expect(findUnknownDrawerOptions(meta, [1, 2])).toEqual([])
    expect(findUnknownDrawerOptions(meta, 'nope')).toEqual([])
  })
})

describe('warnUnknownDrawerOptions', () => {
  let warn: jest.SpyInstance

  beforeEach(() => {
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    warn.mockRestore()
  })

  test('names the drawer, the ignored keys and the keys it does read', () => {
    warnUnknownDrawerOptions(
      {
        name: 'myPlugin/heatmap',
        optionsSchema: { colorRamp: 'cool | warm', cellGap: 'px' },
      },
      { colorRamp: 'warm', colourRamp: 'warm' },
    )

    expect(warn).toHaveBeenCalledTimes(1)
    const message = warn.mock.calls[0]![0] as string
    expect(message).toContain('[feature-chart]')
    expect(message).toContain('"myPlugin/heatmap"')
    expect(message).toContain('"colourRamp"')
    expect(message).not.toContain('"colorRamp",')
    expect(message).toContain('it reads: colorRamp, cellGap')
  })

  test('says a built-in reads no options at all', () => {
    warnUnknownDrawerOptions(
      { name: 'barPlot', optionsSchema: {} },
      { colorRamp: 'warm' },
    )
    expect(warn.mock.calls[0]![0]).toContain('reads no drawerOptions')
  })

  test('warns once per drawer and key set, not once per rendered chart', () => {
    const meta = {
      name: 'myPlugin/heatmap',
      optionsSchema: { cellGap: 'px' },
    }
    const options = { cellGapp: 1 }
    expect(warnUnknownDrawerOptions(meta, options)).toEqual(['cellGapp'])
    expect(warnUnknownDrawerOptions(meta, options)).toEqual(['cellGapp'])
    expect(warnUnknownDrawerOptions(meta, { ...options })).toEqual(['cellGapp'])
    expect(warn).toHaveBeenCalledTimes(1)
  })

  test('stays quiet for declared keys and for drawers without a schema', () => {
    warnUnknownDrawerOptions(
      { name: 'myPlugin/heatmap', optionsSchema: { cellGap: 'px' } },
      { cellGap: 2 },
    )
    warnUnknownDrawerOptions({ name: 'uneditedPlugin/x' }, { anything: 1 })
    warnUnknownDrawerOptions(undefined, { anything: 1 })
    expect(warn).not.toHaveBeenCalled()
  })
})
