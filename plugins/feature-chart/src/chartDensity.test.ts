import {
  TOO_MANY_CHARTS_MESSAGE,
  shouldShowChartWarning,
} from './chartDensity.ts'

const options = { chartWidth: 120, maxChartsPerView: 10, minChartSpacingPx: 4 }

describe('shouldShowChartWarning', () => {
  test('an empty view warns about nothing', () => {
    expect(shouldShowChartWarning([], options)).toBe(false)
  })

  test('one chart never warns', () => {
    expect(shouldShowChartWarning([{ x: 0 }], options)).toBe(false)
  })

  test('more charts than maxChartsPerView warns', () => {
    const items = Array.from({ length: 11 }, (_, index) => ({
      x: index * 200,
    }))
    expect(shouldShowChartWarning(items, options)).toBe(true)
  })

  test('exactly maxChartsPerView charts with room do not warn', () => {
    const items = Array.from({ length: 10 }, (_, index) => ({
      x: index * 200,
    }))
    expect(shouldShowChartWarning(items, options)).toBe(false)
  })

  test('charts closer than minChartSpacingPx warn even below the count limit', () => {
    // gap = x - (0 + chartWidth); 4px is enough, 3px is not
    expect(shouldShowChartWarning([{ x: 0 }, { x: 124 }], options)).toBe(false)
    expect(shouldShowChartWarning([{ x: 0 }, { x: 123 }], options)).toBe(true)
  })

  test('the message says what to do', () => {
    expect(TOO_MANY_CHARTS_MESSAGE).toContain('zoom in')
  })
})
