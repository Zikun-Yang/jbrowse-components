import {
  CHART_DATA_FORMS,
  CHART_KINDS,
  CHART_KIND_DATA_FORMS,
  formatChartSpecError,
  normalizeFromSpec,
  normalizeValidatedSpec,
  resolveDataPath,
  validateChartSpec,
} from './chartSpec.ts'

const groupedValues = {
  tissues: {
    Brain: [35.06, 36.33, 43.78, 50.87],
    Liver: [6.46, 9.76, 15.41, 19.58],
  },
}
const summaryStats = {
  boxes: [
    {
      name: 'Brain',
      min: 40.13,
      q1: 41.49,
      median: 49.99,
      q3: 53.38,
      max: 54.58,
    },
  ],
}
const categoryValues = {
  bars: [
    { name: 'Brain', value: 42 },
    { name: 'Liver', value: 18 },
  ],
}
const flatValues = { values: [0.1, 1.38, 1.96, 3.53] }

function spec(overrides: Record<string, unknown> = {}) {
  return {
    specVersion: 1,
    kind: 'box',
    data: { form: 'grouped-values', path: 'tissues' },
    ...overrides,
  }
}

describe('the v1 vocabulary', () => {
  test('there is exactly one spelling per term (kebab-case)', () => {
    expect(CHART_KINDS).toEqual(['box', 'violin', 'bar', 'histogram'])
    expect(CHART_DATA_FORMS).toEqual([
      'summary-stats',
      'grouped-values',
      'category-values',
      'values',
    ])
    // the legality matrix is the contract (SPEC.md §1): five rows, one per
    // pre-WP3 built-in drawer, and nothing else
    expect(CHART_KIND_DATA_FORMS).toEqual({
      box: ['grouped-values', 'summary-stats'],
      violin: ['grouped-values'],
      bar: ['category-values'],
      histogram: ['values'],
    })
  })

  test('every kind except box accepts exactly one form', () => {
    for (const kind of ['violin', 'bar', 'histogram'] as const) {
      expect(CHART_KIND_DATA_FORMS[kind]).toHaveLength(1)
    }
    expect(CHART_KIND_DATA_FORMS.box).toHaveLength(2)
  })
})

describe('legal kind × form combinations', () => {
  // The whole matrix, not a sample: 5 combinations accepted, 15 rejected.
  // one payload per form, plus the `data.path` that reaches it
  const containers: Record<string, { data: unknown; path: string }> = {
    'summary-stats': { data: summaryStats, path: 'boxes' },
    'grouped-values': { data: groupedValues, path: 'tissues' },
    'category-values': { data: categoryValues, path: 'bars' },
    values: { data: flatValues, path: 'values' },
  }

  test.each(
    CHART_KINDS.flatMap(kind =>
      CHART_DATA_FORMS.map(form => [
        `${kind} + ${form}`,
        kind,
        form,
        CHART_KIND_DATA_FORMS[kind].includes(form),
      ] as const),
    ),
  )('%s', (_label, kind, form, legal) => {
    const payload = containers[form]!
    const candidate = spec({ kind, data: { form, path: payload.path } })
    const errors = validateChartSpec(candidate)
    if (legal) {
      expect(errors).toEqual([])
      const normalization = normalizeFromSpec(candidate, payload.data)
      expect(normalization.errors).toEqual([])
      if (!normalization.model) {
        throw new Error('expected a model')
      }
      expect(normalization.model.kind).toBe(kind)
    } else {
      expect(errors.map(error => error.path)).toContain('spec.data.form')
      expect(errors[0]!.allowed).toEqual([...CHART_KIND_DATA_FORMS[kind]])
    }
  })
})

describe('normalizeFromSpec', () => {
  test('summary-stats keeps categories, order and the five numbers', () => {
    const { model } = normalizeFromSpec(
      spec({ data: { form: 'summary-stats', path: 'boxes' } }),
      summaryStats,
    )
    expect(model).toEqual({
      kind: 'box',
      categories: ['Brain'],
      series: [
        {
          name: 'values',
          data: [
            {
              form: 'summary-stats',
              stats: { min: 40.13, q1: 41.49, median: 49.99, q3: 53.38, max: 54.58 },
            },
          ],
        },
      ],
      style: {},
      axes: {},
    })
  })

  test('grouped-values keeps object key order and drops non-finite numbers', () => {
    const { model } = normalizeFromSpec(spec(), {
      tissues: { Brain: [1, null, '3', 4, NaN], Liver: [], Heart: [2] },
    })
    expect(model?.categories).toEqual(['Brain', 'Heart'])
    expect(model?.series[0]?.data).toEqual([
      { form: 'grouped-values', values: [1, 4] },
      { form: 'grouped-values', values: [2] },
    ])
  })

  test('category-values keeps name/value pairs', () => {
    const { model } = normalizeFromSpec(
      spec({ kind: 'bar', data: { form: 'category-values', path: 'bars' } }),
      categoryValues,
    )
    expect(model?.categories).toEqual(['Brain', 'Liver'])
    expect(model?.series[0]?.data).toEqual([
      { form: 'category-values', value: 42 },
      { form: 'category-values', value: 18 },
    ])
  })

  test('values produces one flat datum and no categories', () => {
    const { model } = normalizeFromSpec(
      spec({
        kind: 'histogram',
        data: { form: 'values', path: 'values' },
      }),
      flatValues,
    )
    expect(model?.categories).toEqual([])
    expect(model?.series[0]?.data).toEqual([
      { form: 'values', values: [0.1, 1.38, 1.96, 3.53] },
    ])
  })

  test('style and axes reach the model, and empty strings do not', () => {
    const { model } = normalizeFromSpec(
      spec({
        style: { colorScheme: 'viridis', bins: 16 },
        axes: { yLabel: 'TPM' },
        kind: 'histogram',
        data: { form: 'values', path: 'values' },
      }),
      flatValues,
    )
    expect(model?.style).toEqual({ colorScheme: 'viridis', bins: 16 })
    expect(model?.axes).toEqual({ yLabel: 'TPM' })

    const blank = normalizeFromSpec(
      spec({ data: { form: 'grouped-values', path: 'tissues' }, axes: { yLabel: '' } }),
      groupedValues,
    )
    expect(blank.model?.axes).toEqual({})
  })

  test('an empty payload is an empty model, not an error', () => {
    const { model, errors } = normalizeFromSpec(spec(), { tissues: {} })
    expect(errors).toEqual([])
    expect(model?.categories).toEqual([])
    expect(model?.series[0]?.data).toEqual([])
  })

  test('tolerates data that is not an object at all', () => {
    for (const data of [undefined, null, 42, 'nope', [1, 2]]) {
      const result = normalizeFromSpec(spec(), data)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors[0]!.path).toBe('spec.data.path')
    }
  })
})

describe('data.path', () => {
  test('empty path is the root; dotted path walks objects; digits index arrays', () => {
    expect(resolveDataPath(groupedValues, '').value).toBe(groupedValues)
    expect(resolveDataPath(groupedValues, 'tissues.Brain').value).toEqual([
      35.06, 36.33, 43.78, 50.87,
    ])
    expect(resolveDataPath({ rows: [{ values: [1, 2] }] }, 'rows.0.values').value).toEqual([
      1, 2,
    ])
  })

  test('a missing key reports the path and the keys that were there', () => {
    const { error } = resolveDataPath(groupedValues, 'tumor')
    expect(error?.path).toBe('spec.data.path')
    expect(error?.message).toContain('missing key "tumor"')
    expect(error?.actualKeys).toEqual(['tissues'])
  })

  test('no selector language: a wildcard is a missing key, not a query', () => {
    const { error } = resolveDataPath(groupedValues, '$..values')
    expect(error?.message).toContain('"$"')
    expect(error?.actualKeys).toEqual(['tissues'])
  })

  test('an array segment that is not an index says so', () => {
    const { error } = resolveDataPath({ rows: [{ values: [1] }] }, 'rows.first')
    expect(error?.message).toContain('needs an array index')
  })
})

describe('structural errors (SPEC.md §8)', () => {
  test('unknown kind lists every kind', () => {
    const errors = validateChartSpec(spec({ kind: 'heatmap' }))
    expect(errors[0]).toMatchObject({
      path: 'spec.kind',
      allowed: ['box', 'violin', 'bar', 'histogram'],
    })
  })

  test('unknown form lists every form', () => {
    const errors = validateChartSpec(spec({ data: { form: 'groupedValues' } }))
    expect(errors[0]).toMatchObject({
      path: 'spec.data.form',
      allowed: ['summary-stats', 'grouped-values', 'category-values', 'values'],
    })
    // the camelCase spelling is a mistake worth an exact message, not a guess
    expect(errors[0]!.message).toContain('groupedValues')
  })

  test('a specVersion from the future says the build is too old', () => {
    const errors = validateChartSpec(spec({ specVersion: 2 }))
    expect(errors[0]).toMatchObject({ path: 'spec.specVersion' })
    expect(errors[0]!.message).toContain('newer than this build supports (1)')
    expect(errors[0]!.message).toContain('Update BioSeek / JBrowse')
  })

  test('specVersion is required and must be an integer', () => {
    const missing = validateChartSpec({
      kind: 'box',
      data: { form: 'grouped-values' },
    })
    expect(missing.map(error => error.path)).toContain('spec.specVersion')

    expect(
      validateChartSpec(spec({ specVersion: 1.5 })).map(error => error.path),
    ).toContain('spec.specVersion')
  })

  test('unknown keys are errors, not silent no-ops', () => {
    const errors = validateChartSpec(
      spec({ style: { colourScheme: 'viridis' } }),
    )
    expect(errors[0]).toMatchObject({ path: 'spec.style' })
    expect(errors[0]!.message).toContain('colourScheme')
    expect(errors[0]!.actualKeys).toEqual(['colourScheme'])
  })

  test('style and axes values are checked against their closed sets', () => {
    expect(
      validateChartSpec(spec({ style: { colorScheme: 'plasma' } }))[0],
    ).toMatchObject({
      path: 'spec.style.colorScheme',
      allowed: ['blues', 'dark2', 'set2', 'tableau10', 'viridis'],
    })
    expect(
      validateChartSpec(spec({ style: { bins: 0 } }))[0]!.message,
    ).toContain('between 1 and 100')
    expect(
      validateChartSpec(spec({ style: { bins: 4 } }))[0]!.message,
    ).toContain('only applies to kind "histogram"')
    expect(
      validateChartSpec(spec({ axes: { yLabel: 42 } }))[0]!.path,
    ).toBe('spec.axes.yLabel')
  })

  test('a spec that is not an object says what it found', () => {
    expect(validateChartSpec('box')[0]!.message).toContain(
      'found the string "box"',
    )
    expect(validateChartSpec([])[0]!.message).toContain('found an array')
  })
})

describe('data errors point at the payload', () => {
  test('a form that does not match the resolved value lists its keys', () => {
    const { errors } = normalizeFromSpec(
      spec({ data: { form: 'summary-stats', path: '' } }),
      { source: 'GTEx', boxes: [] },
    )
    expect(errors[0]).toMatchObject({
      path: 'spec.data.form',
      actualKeys: ['source', 'boxes'],
    })
    expect(errors[0]!.message).toContain('expects an array')
  })

  test('a form mismatch downgrades to an error, never a guess', () => {
    const { model, errors } = normalizeFromSpec(
      spec({ data: { form: 'grouped-values', path: 'tissues' } }),
      { tissues: [1, 2, 3] },
    )
    expect(model).toBeUndefined()
    expect(errors[0]!.message).toContain('expects an object mapping category')
  })

  test('entries that are all junk report instead of drawing nothing', () => {
    const { errors } = normalizeFromSpec(
      spec({ data: { form: 'summary-stats', path: 'boxes' } }),
      { boxes: [{ name: 'Brain' }, 3, null] },
    )
    expect(errors[0]!.message).toContain('found no usable entry')
  })
})

describe('normalizeValidatedSpec', () => {
  test('skips structural validation for callers that already ran it', () => {
    // Structurally invalid specs are trusted here on purpose: the renderers
    // validate once per render and then normalize per chart.
    const candidate = spec({ data: { form: 'summary-stats', path: 'boxes' } })
    const { model } = normalizeValidatedSpec(
      candidate as never,
      summaryStats,
    )
    expect(model?.kind).toBe('box')
  })
})

describe('formatChartSpecError', () => {
  test('one line with the path, the reason and what was allowed', () => {
    const [error] = validateChartSpec(spec({ kind: 'heatmap' }))
    expect(formatChartSpecError(error!)).toBe(
      'spec.kind: "heatmap" is not a chart kind (allowed: box, violin, bar, histogram)',
    )
  })
})
