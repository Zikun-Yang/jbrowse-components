import { renderMarkdownTemplate } from './renderMarkdownTemplate.ts'

describe('renderMarkdownTemplate', () => {
  test('replaces simple variables', () => {
    const result = renderMarkdownTemplate('Gene {{name}} on {{chrom}}', {
      name: 'GENE1',
      chrom: 'chr1',
    })
    expect(result).toBe('Gene GENE1 on chr1')
  })

  test('replaces nested paths from data', () => {
    const result = renderMarkdownTemplate('Max value: {{data.max}}', {
      name: 'GENE1',
      data: { max: 42 },
    })
    expect(result).toBe('Max value: 42')
  })

  test('leaves missing variables empty', () => {
    const result = renderMarkdownTemplate('{{name}} {{missing}}', {
      name: 'GENE1',
    })
    expect(result).toBe('GENE1 ')
  })

  test('handles whitespace inside braces', () => {
    const result = renderMarkdownTemplate('{{ name }}', { name: 'GENE1' })
    expect(result).toBe('GENE1')
  })
})
