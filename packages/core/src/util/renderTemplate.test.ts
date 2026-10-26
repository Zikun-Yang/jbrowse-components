import {
  renderTemplate,
  resolveTemplatePath,
  stringifyTemplateValue,
} from './renderTemplate.ts'

describe('resolveTemplatePath', () => {
  const context = {
    track: {
      name: 'Tissue expression',
      metadata: { source: 'GEO', nested: { deep: 1 } },
      assemblyNames: ['hg38'],
    },
    items: [{ value: 'a' }, { value: 'b' }],
    flag: false,
    zero: 0,
    empty: '',
  }

  test('resolves top level keys', () => {
    expect(resolveTemplatePath(context, 'flag')).toBe(false)
  })

  test('resolves nested paths', () => {
    expect(resolveTemplatePath(context, 'track.metadata.source')).toBe('GEO')
    expect(resolveTemplatePath(context, 'track.metadata.nested.deep')).toBe(1)
  })

  test('resolves array indices', () => {
    expect(resolveTemplatePath(context, 'items.0.value')).toBe('a')
    expect(resolveTemplatePath(context, 'items.1.value')).toBe('b')
    expect(resolveTemplatePath(context, 'track.assemblyNames.0')).toBe('hg38')
  })

  test('returns undefined for missing keys', () => {
    expect(resolveTemplatePath(context, 'missing')).toBeUndefined()
    expect(resolveTemplatePath(context, 'track.missing')).toBeUndefined()
    expect(resolveTemplatePath(context, 'track.name.deeper')).toBeUndefined()
    expect(resolveTemplatePath(context, 'items.9.value')).toBeUndefined()
    expect(resolveTemplatePath({}, 'a.b.c')).toBeUndefined()
  })

  test('does not traverse into primitives', () => {
    expect(resolveTemplatePath({ a: 'string' }, 'a.length')).toBeUndefined()
    expect(resolveTemplatePath({ a: 5 }, 'a.b')).toBeUndefined()
  })

  test('only resolves own properties', () => {
    expect(resolveTemplatePath({ a: {} }, 'a.constructor')).toBeUndefined()
    expect(resolveTemplatePath({}, 'toString')).toBeUndefined()
    expect(resolveTemplatePath({ a: 'x' }, 'a.__proto__.polluted')).toBe(
      undefined,
    )
  })
})

describe('stringifyTemplateValue', () => {
  test('renders primitives', () => {
    expect(stringifyTemplateValue('text')).toBe('text')
    expect(stringifyTemplateValue(42)).toBe('42')
    expect(stringifyTemplateValue(false)).toBe('false')
    expect(stringifyTemplateValue(0)).toBe('0')
  })

  test('renders null/undefined as empty string', () => {
    expect(stringifyTemplateValue(undefined)).toBe('')
    expect(stringifyTemplateValue(null)).toBe('')
  })

  test('renders objects and arrays as JSON', () => {
    expect(stringifyTemplateValue({ a: 1 })).toBe('{"a":1}')
    expect(stringifyTemplateValue(['a', 'b'])).toBe('["a","b"]')
  })
})

describe('renderTemplate', () => {
  test('replaces simple and nested variables', () => {
    expect(
      renderTemplate('{{ track.name }} in {{assembly.displayName}}', {
        track: { name: 'Tissue expression' },
        assembly: { displayName: 'Human (GRCh38)' },
      }),
    ).toBe('Tissue expression in Human (GRCh38)')
  })

  test('replaces array index paths', () => {
    expect(
      renderTemplate('{{items.0.value}}/{{items.1.value}}', {
        items: [{ value: 'a' }, { value: 'b' }],
      }),
    ).toBe('a/b')
  })

  test('renders unknown variables as empty string without throwing', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    expect(renderTemplate('a{{nope}}b{{ track.missing }}c', {})).toBe('abc')
    warn.mockRestore()
  })

  test('renders empty template and template without variables unchanged', () => {
    expect(renderTemplate('', { a: 1 })).toBe('')
    expect(renderTemplate('plain text', { a: 1 })).toBe('plain text')
  })

  test('renders null values as empty string', () => {
    expect(renderTemplate('[{{a}}]', { a: null })).toBe('[]')
  })

  test('does not re-render substituted values', () => {
    expect(renderTemplate('{{a}}', { a: '{{b}}', b: 'nope' })).toBe('{{b}}')
  })

  test('does not mutate the context or freeze issues', () => {
    const context = { track: { name: 'x' }, list: ['y'] }
    const before = JSON.stringify(context)
    renderTemplate('{{track.name}} {{list.0}}', context)
    expect(JSON.stringify(context)).toBe(before)

    const frozen = Object.freeze({ a: Object.freeze({ b: 'c' }) })
    expect(renderTemplate('{{a.b}}', frozen)).toBe('c')
  })

  test('handles malformed templates', () => {
    expect(renderTemplate('{{unclosed', {})).toBe('{{unclosed')
    expect(renderTemplate('{{}}', {})).toBe('{{}}')
    // @ts-expect-error - mismatched type should not throw
    expect(renderTemplate(undefined, {})).toBe('')
  })

  test('warns once per unknown path', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    renderTemplate('{{onlyOnceMissing}}', {})
    renderTemplate('{{onlyOnceMissing}}', {})
    expect(warn).toHaveBeenCalledTimes(1)
    warn.mockRestore()
  })
})
