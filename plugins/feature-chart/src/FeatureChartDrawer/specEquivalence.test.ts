import { barModelFromBars, barPlotDrawer } from './barPlot.ts'
import {
  boxModelFromPrecomputed,
  boxModelFromTissues,
  precomputedBoxPlotDrawer,
  rawBoxPlotDrawer,
} from './boxPlot.ts'
import { DEFAULT_SERIES_NAME } from './chartModel.ts'
import { normalizeFromSpec } from './chartSpec.ts'
import { traceDraw } from './drawerTestHelpers.ts'
import { histogramModelFromValues, histogramPlotDrawer } from './histogramPlot.ts'
import { specDrawer } from './specDrawer.ts'
import { rawViolinPlotDrawer, violinModelFromTissues } from './violinPlot.ts'

/**
 * The v1 vocabulary promises that `spec` draws *exactly* what the five legacy
 * drawers draw ("v1 adds nothing the old painters could not render", SPEC.md §1).
 *
 * The strongest cheap proof of that is here: for each legacy drawer, its model
 * equals the model its spec produces, and both paint the identical sequence of
 * canvas operations with identical state. Not a visual approximation — the same
 * calls with the same arguments.
 */

const payloads = {
  precomputedBoxPlot: {
    boxes: [
      { name: 'Brain', min: 40.13, q1: 41.49, median: 49.99, q3: 53.38, max: 54.58 },
      { name: 'Liver', min: 13.05, q1: 13.22, median: 21.45, q3: 25.33, max: 25.63 },
    ],
  },
  rawBoxPlot: {
    tissues: { Brain: [35.06, 36.33, 43.78, 50.87], Liver: [6.46, 9.76, 15.41] },
  },
  rawViolinPlot: {
    tissues: { Brain: [35.06, 36.33, 43.78, 50.87], Liver: [6.46, 9.76, 15.41] },
  },
  barPlot: {
    bars: [
      { name: 'Brain', value: 42 },
      { name: 'Liver', value: 18 },
    ],
  },
  histogram: { values: [0.1, 1.38, 1.96, 3.53, 4.02, 5.59, 9.79, 11.61] },
}

const cases = [
  {
    name: 'precomputedBoxPlot',
    drawer: precomputedBoxPlotDrawer,
    legacyModel: (data: unknown) => boxModelFromPrecomputed(data),
    spec: {
      specVersion: 1,
      kind: 'box',
      data: { form: 'summary-stats', path: 'boxes' },
    },
  },
  {
    name: 'rawBoxPlot',
    drawer: rawBoxPlotDrawer,
    legacyModel: (data: unknown) => boxModelFromTissues(data),
    spec: {
      specVersion: 1,
      kind: 'box',
      data: { form: 'grouped-values', path: 'tissues' },
    },
  },
  {
    name: 'rawViolinPlot',
    drawer: rawViolinPlotDrawer,
    legacyModel: (data: unknown) => violinModelFromTissues(data),
    spec: {
      specVersion: 1,
      kind: 'violin',
      data: { form: 'grouped-values', path: 'tissues' },
    },
  },
  {
    name: 'barPlot',
    drawer: barPlotDrawer,
    legacyModel: (data: unknown) => barModelFromBars(data),
    spec: {
      specVersion: 1,
      kind: 'bar',
      data: { form: 'category-values', path: 'bars' },
    },
  },
  {
    name: 'histogram',
    drawer: histogramPlotDrawer,
    legacyModel: (data: unknown) => histogramModelFromValues(data),
    spec: {
      specVersion: 1,
      kind: 'histogram',
      data: { form: 'values', path: 'values' },
    },
  },
] as const

describe.each(cases)('$name ↔ its spec preset', ({ name, ...rest }) => {
  const data = payloads[name]

  test('the legacy model and the spec model are the same model', () => {
    const normalization = normalizeFromSpec(rest.spec, data)
    expect(normalization.errors).toEqual([])
    expect(normalization.model).toEqual(
      rest.legacyModel(data as never) as never,
    )
    expect(normalization.model?.series[0]?.name).toBe(DEFAULT_SERIES_NAME)
  })

  test('both paint the identical trace', () => {
    const { model } = normalizeFromSpec(rest.spec, data)
    const legacyTrace = traceDraw(rest.drawer, data)
    const specTrace = traceDraw(specDrawer, data, { model })
    expect(specTrace.length).toBeGreaterThan(10)
    expect(specTrace).toEqual(legacyTrace)
  })

  test('an empty payload: the legacy drawer draws nothing, the spec explains why', () => {
    // This is the one intentional behavioural difference. A legacy drawer gets
    // `data.tissues === undefined` and paints an empty chart; a spec says where
    // its data lives, so a missing path is diagnosable instead of invisible.
    const empty = {}
    expect(traceDraw(rest.drawer, empty)).toEqual([])
    expect(normalizeFromSpec(rest.spec, empty).errors[0]?.path).toBe(
      'spec.data.path',
    )
    expect(
      traceDraw(specDrawer, empty, {
        modelErrors: normalizeFromSpec(rest.spec, empty).errors,
      }).length,
    ).toBeGreaterThan(0)
  })
})

describe('axes.yLabel is the only difference v1 adds', () => {
  const data = payloads.rawBoxPlot
  const baseSpec = {
    specVersion: 1,
    kind: 'box',
    data: { form: 'grouped-values', path: 'tissues' },
  } as const

  function withoutLabel() {
    return traceDraw(specDrawer, data, {
      model: normalizeFromSpec(baseSpec, data).model,
    })
  }

  function withLabel() {
    return traceDraw(specDrawer, data, {
      model: normalizeFromSpec(
        { ...baseSpec, axes: { yLabel: 'TPM' } },
        data,
      ).model,
    })
  }

  test('the extra left margin is the documented 14px', () => {
    const translateOf = (trace: unknown[]) =>
      trace.find(
        event => Array.isArray(event) && event[0] === 'translate',
      ) as [string, number, number]
    expect(translateOf(withoutLabel())[1]).toBeCloseTo(120 * 0.14)
    expect(translateOf(withLabel())[1]).toBeCloseTo(120 * 0.14 + 14)
  })

  test('the label is one rotated text, and nothing else moves', () => {
    const plain = withoutLabel() as [string, ...unknown[]][]
    const labelled = withLabel() as [string, ...unknown[]][]

    expect(labelled.some(event => event[0] === 'rotate')).toBe(true)
    expect(plain.some(event => event[0] === 'rotate')).toBe(false)

    const countOf = (trace: [string, ...unknown[]][], name: string) =>
      trace.filter(event => event[0] === name).length
    // exactly one extra fillText: the label itself
    expect(countOf(labelled, 'fillText')).toBe(countOf(plain, 'fillText') + 1)

    const labelText = labelled.find(
      event => event[0] === 'fillText' && event[1] === 'TPM',
    )
    expect(labelText).toBeDefined()
  })
})
