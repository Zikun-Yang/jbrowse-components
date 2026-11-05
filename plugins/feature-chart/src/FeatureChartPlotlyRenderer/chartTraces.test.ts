import { barModelFromBars } from '../FeatureChartDrawer/barPlot.ts'
import {
  boxModelFromPrecomputed,
  boxModelFromTissues,
} from '../FeatureChartDrawer/boxPlot.ts'
import { resolveColorScheme } from '../FeatureChartDrawer/colorSchemes.ts'
import { histogramModelFromValues } from '../FeatureChartDrawer/histogramPlot.ts'
import {
  chartModelCategories,
  computeBins,
} from '../FeatureChartDrawer/painters.ts'
import { violinModelFromTissues } from '../FeatureChartDrawer/violinPlot.ts'
import {
  chartModelLayout,
  chartModelTraces,
} from '../FeatureChartPlotlyRenderer/chartTraces.ts'

const colorScheme = resolveColorScheme(undefined, 'tableau10')

const boxFromStats = boxModelFromPrecomputed({
  boxes: [
    { name: 'Brain', min: 1, q1: 2, median: 3, q3: 4, max: 5 },
    { name: 'Liver', min: 2, q1: 3, median: 4, q3: 5, max: 6 },
  ],
})

const boxFromGroups = boxModelFromTissues({
  tissues: { Liver: [5, 6, 7], Brain: [1, 2, 3] },
})

const violin = violinModelFromTissues({
  tissues: { Brain: [1, 2, 3, 4, 5] },
})

const bars = barModelFromBars({
  bars: [
    { name: 'Brain', value: 42 },
    { name: 'Liver', value: 7 },
  ],
})

const histogram = histogramModelFromValues({
  values: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  bins: 5,
})

describe('chartModelTraces', () => {
  test('box with precomputed stats uses the quartiles, not synthetic data', () => {
    const traces = chartModelTraces(boxFromStats, colorScheme)
    expect(traces).toHaveLength(2)
    expect(traces[0]).toMatchObject({
      type: 'box',
      name: 'Brain',
      q1: 2,
      median: 3,
      q3: 4,
      lowerfence: 1,
      upperfence: 5,
      y: [1, 5],
    })
    // palette order matches the canvas painter (category index)
    expect((traces[1] as { line: { color: string } }).line.color).toBe(
      colorScheme.colors[1],
    )
  })

  test('box from raw groups keeps model category order and the painted whiskers', () => {
    // `Object.entries` order, i.e. the payload order — same as the canvas.
    expect(boxFromGroups.categories).toEqual(['Liver', 'Brain'])
    const traces = chartModelTraces(boxFromGroups, colorScheme)
    expect(traces.map(trace => (trace as { name: string }).name)).toEqual([
      'Liver',
      'Brain',
    ])
    // The canvas painter clamps whiskers at 1.5×IQR (`summarize()`), so the
    // Plotly trace carries those numbers instead of letting Plotly recompute a
    // possibly different whisker rule.
    expect(traces[0]).toMatchObject({
      median: 6,
      q1: 5.5,
      q3: 6.5,
      lowerfence: 5,
      upperfence: 7,
      y: [5, 7],
    })
  })

  test('violin traces carry the observations and hide Plotly extras', () => {
    const [trace] = chartModelTraces(violin, colorScheme) as unknown as [
      {
        type: string
        y: number[]
        box: { visible: boolean }
        meanline: { visible: boolean }
      },
    ]
    expect(trace).toMatchObject({
      type: 'violin',
      y: [1, 2, 3, 4, 5],
      box: { visible: false },
      meanline: { visible: false },
    })
  })

  test('bar is one trace with per-category marker colors', () => {
    const [trace] = chartModelTraces(bars, colorScheme) as unknown as [
      {
        x: string[]
        y: number[]
        marker: { color: string[]; line: { color: string[] } }
      },
    ]
    expect(trace.x).toEqual(['Brain', 'Liver'])
    expect(trace.y).toEqual([42, 7])
    expect(trace.marker.line.color).toEqual([
      colorScheme.colors[0],
      colorScheme.colors[1],
    ])
    // translucent fill, opaque stroke: the canvas convention
    expect(trace.marker.color[0]).toBe(`${colorScheme.colors[0]}33`)
  })

  test('histogram uses the canvas binning, not Plotly nbinsx', () => {
    const bins = computeBins([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 5)
    const [trace] = chartModelTraces(histogram, colorScheme) as unknown as [
      {
        x: number[]
        y: number[]
        width: number[]
      },
    ]
    expect(trace.y).toEqual(bins.counts)
    expect(trace.x).toHaveLength(bins.counts.length)
    expect(trace.x[0]).toBeCloseTo((bins.edges[0]! + bins.edges[1]!) / 2)
    expect(trace.width[0]).toBeCloseTo(bins.edges[1]! - bins.edges[0]!)
  })
})

describe('chartModelLayout', () => {
  test('pins the y window and ticks to the canvas numbers', () => {
    const layout = chartModelLayout({
      model: boxFromStats,
      colorScheme,
      width: 120,
      height: 180,
      fontSize: 8,
    })
    const yaxis = layout.yaxis as {
      range: [number, number]
      tickvals: number[]
    }
    // padded domain [0.75, 6.25], then `nice()` on a 0.5 step
    expect(yaxis.range).toEqual([0.5, 6.5])
    expect(yaxis.tickvals.length).toBeGreaterThan(1)
    expect(layout.paper_bgcolor).toBe(colorScheme.background)
  })

  test('pins x category order so Plotly cannot sort alphabetically', () => {
    const layout = chartModelLayout({
      model: boxFromGroups,
      colorScheme,
      width: 120,
      height: 180,
      fontSize: 8,
    })
    expect(layout.xaxis).toMatchObject({
      type: 'category',
      categoryorder: 'array',
      categoryarray: ['Liver', 'Brain'],
    })
  })

  test('histogram pins both axes and disables the category axis', () => {
    const layout = chartModelLayout({
      model: histogram,
      colorScheme,
      width: 120,
      height: 180,
      fontSize: 8,
    })
    const xaxis = layout.xaxis as { type?: string; range: [number, number] }
    expect(xaxis.type).toBeUndefined()
    expect(xaxis.range).toEqual([0, 9])
  })

  test('the y label travels from the model into the axis title', () => {
    const labelled: typeof bars = {
      ...bars,
      axes: { ...bars.axes, yLabel: 'TPM' },
    }
    const layout = chartModelLayout({
      model: labelled,
      colorScheme,
      width: 120,
      height: 180,
      fontSize: 8,
    })
    expect(layout.yaxis).toMatchObject({ title: { text: 'TPM' } })
  })
})

describe('model parity with the canvas painters', () => {
  test('both backends see the same categories in the same order', () => {
    for (const model of [boxFromStats, boxFromGroups, violin, bars]) {
      expect(chartModelCategories(model).map(entry => entry.name)).toEqual(
        model.categories,
      )
    }
  })

  test('a legacy color override wins over the palette in both backends', () => {
    const withColor = barModelFromBars({
      bars: [{ name: 'Brain', value: 1, color: '#ff0000' }],
    })
    const [trace] = chartModelTraces(withColor, colorScheme) as unknown as [
      { marker: { color: string[] } },
    ]
    expect(trace.marker.color[0]).toBe('#ff000033')
  })
})
