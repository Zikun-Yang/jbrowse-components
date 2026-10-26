import { stripDefaultColors, stripLegacyMultiRowColors } from './util.ts'

describe('stripLegacyMultiRowColors', () => {
  test('removes the hardcoded blue that multi-row layouts used to save', () => {
    expect(
      stripLegacyMultiRowColors([
        { name: 'k1', source: 'k1', color: 'blue' },
        { name: 'k2', source: 'k2', color: 'blue' },
      ]),
    ).toEqual([
      { name: 'k1', source: 'k1' },
      { name: 'k2', source: 'k2' },
    ])
  })

  test('treats the hex form of the same blue as the legacy default', () => {
    expect(
      stripLegacyMultiRowColors([
        { name: 'k1', source: 'k1', color: '#0000ff' },
        { name: 'k2', source: 'k2', color: '#0000ff' },
      ]),
    ).toEqual([
      { name: 'k1', source: 'k1' },
      { name: 'k2', source: 'k2' },
    ])
  })

  test('keeps a layout the user colored source by source', () => {
    const layout = [
      { name: 'k1', source: 'k1', color: 'blue' },
      { name: 'k2', source: 'k2', color: 'red' },
    ]
    expect(stripLegacyMultiRowColors(layout)).toBe(layout)
  })

  test('keeps a user chosen color that is not the legacy default', () => {
    const layout = [
      { name: 'k1', source: 'k1', color: '#292421' },
      { name: 'k2', source: 'k2', color: '#292421' },
    ]
    expect(stripLegacyMultiRowColors(layout)).toBe(layout)
  })

  test('keeps a layout with a single source', () => {
    const layout = [{ name: 'k1', source: 'k1', color: 'blue' }]
    expect(stripLegacyMultiRowColors(layout)).toBe(layout)
  })
})

describe('stripDefaultColors', () => {
  const defaults = new Map([
    ['k1', '#292421'],
    ['k2', '#292421'],
  ])
  const defaultColorFor = (name: string) => defaults.get(name)

  test('drops colors the display derived itself', () => {
    expect(
      stripDefaultColors(
        [
          { name: 'k1', source: 'k1', color: '#292421' },
          { name: 'k2', source: 'k2', color: '#292421' },
        ],
        defaultColorFor,
      ),
    ).toEqual([
      { name: 'k1', source: 'k1' },
      { name: 'k2', source: 'k2' },
    ])
  })

  test('keeps colors the user picked', () => {
    expect(
      stripDefaultColors(
        [{ name: 'k1', source: 'k1', color: 'salmon' }],
        defaultColorFor,
      ),
    ).toEqual([{ name: 'k1', source: 'k1', color: 'salmon' }])
  })

  test('keeps colors of sources without a known default', () => {
    expect(
      stripDefaultColors(
        [{ name: 'k3', source: 'k3', color: 'salmon' }],
        defaultColorFor,
      ),
    ).toEqual([{ name: 'k3', source: 'k3', color: 'salmon' }])
  })

  test('keeps the rest of a row, including its group and order fields', () => {
    expect(
      stripDefaultColors(
        [{ name: 'k1', source: 'k1', group: 'g', color: '#292421' }],
        defaultColorFor,
      ),
    ).toEqual([{ name: 'k1', source: 'k1', group: 'g' }])
  })
})
