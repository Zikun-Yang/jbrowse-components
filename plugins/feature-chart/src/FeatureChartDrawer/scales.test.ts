import { scaleBand, scaleLinear, tickValues } from './scales.ts'

describe('scaleBand', () => {
  test('lays out centered bands with d3 padding semantics', () => {
    const scale = scaleBand()
      .domain(['Brain', 'Liver', 'Heart'])
      .range([0, 300])
      .padding(0.3)

    // step = 300 / (3 - 0.3 + 0.6) = 90.909..., offset = (300 - step*2.7)/2
    expect(scale.bandwidth()).toBeCloseTo(63.636, 2)
    expect(scale('Brain')).toBeCloseTo(27.273, 2)
    expect(scale('Liver')).toBeCloseTo(118.182, 2)
    expect(scale('Heart')).toBeCloseTo(209.091, 2)
    expect(scale('Unknown')).toBeUndefined()
  })

  test('keeps a single band centered inside the range', () => {
    const scale = scaleBand().domain(['Only']).range([0, 100]).padding(0)

    expect(scale.bandwidth()).toBeCloseTo(100)
    expect(scale('Only')).toBeCloseTo(0)
  })

  test('supports an inverted range', () => {
    const scale = scaleBand().domain(['a', 'b']).range([200, 0]).padding(0)

    expect(scale.bandwidth()).toBeCloseTo(100)
    expect(scale('a')).toBeCloseTo(100)
    expect(scale('b')).toBeCloseTo(0)
  })
})

describe('scaleLinear', () => {
  test('maps the domain onto the range', () => {
    const scale = scaleLinear().domain([0, 100]).range([200, 0])

    expect(scale(0)).toBe(200)
    expect(scale(50)).toBe(100)
    expect(scale(100)).toBe(0)
  })

  test('avoids dividing by zero for a flat domain', () => {
    const scale = scaleLinear().domain([5, 5]).range([10, 20])

    expect(scale(5)).toBe(10)
  })

  test('nice() rounds the domain outwards on nice steps', () => {
    const scale = scaleLinear().domain([3.2, 97.1]).range([0, 1]).nice()

    expect(scale.ticks(10)).toEqual([
      0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100,
    ])
  })

  test('keeps an already nice domain untouched', () => {
    const scale = scaleLinear().domain([0, 100]).range([0, 1]).nice()

    expect(scale.ticks(5)).toEqual([0, 20, 40, 60, 80, 100])
  })

  test('nice() leaves an empty domain alone', () => {
    const scale = scaleLinear().domain([0, 0]).nice()

    expect(scale.ticks(5)).toEqual([])
  })
})

describe('tickValues', () => {
  test('produces step-aligned ticks inside the domain', () => {
    expect(tickValues(0, 1, 5)).toEqual([0, 0.2, 0.4, 0.6, 0.8, 1])
  })

  test('does not accumulate floating point noise on small steps', () => {
    const ticks = tickValues(0, 1, 10)

    for (const tick of ticks) {
      expect(Number(tick.toFixed(10))).toBe(tick)
    }
  })

  test('returns ticks in domain order for descending domains', () => {
    expect(tickValues(100, 0, 5)).toEqual([100, 80, 60, 40, 20, 0])
  })

  test('returns an empty list for a degenerate domain', () => {
    expect(tickValues(5, 5, 5)).toEqual([])
    expect(tickValues(Number.NaN, 10, 5)).toEqual([])
  })
})
