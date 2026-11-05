import { markdownToPlainText } from './markdownToPlainText.ts'

describe('markdownToPlainText', () => {
  test('returns an empty string for missing or blank input', () => {
    expect(markdownToPlainText('')).toBe('')
    expect(markdownToPlainText('   \n\n ')).toBe('')
    // @ts-expect-error - a broken config must not crash the caller
    expect(markdownToPlainText(undefined)).toBe('')
  })

  test('leaves plain prose alone', () => {
    expect(markdownToPlainText('Tissue expression from GTEx.')).toBe(
      'Tissue expression from GTEx.',
    )
  })

  test('drops heading markers but keeps the text on its own line', () => {
    expect(markdownToPlainText('# Title\n\n## Details\nbody')).toBe(
      'Title\n\nDetails\nbody',
    )
  })

  test('flattens lists to one line per item', () => {
    expect(
      markdownToPlainText(
        '- brain\n- liver\n\n1. first\n2. second\n\n> quoted\n> more',
      ),
    ).toBe('brain\nliver\n\nfirst\nsecond\n\nquoted\nmore')
  })

  test('removes emphasis, inline code and strikethrough markers', () => {
    expect(
      markdownToPlainText(
        '**bold** and *italic* and `code` and ~~gone~~ and __alt__ and _em_',
      ),
    ).toBe('bold and italic and code and gone and alt and em')
  })

  test('keeps link targets as "label (url)" and drops raw html', () => {
    expect(
      markdownToPlainText(
        'see [GTEx](https://gtexportal.org) and <b>bold</b> and <https://jbrowse.org>',
      ),
    ).toBe('see GTEx (https://gtexportal.org) and bold and https://jbrowse.org')
  })

  test('renders images as alt text plus url', () => {
    expect(markdownToPlainText('![legend](legend.png)')).toBe(
      'legend (legend.png)',
    )
  })

  test('keeps code fence contents and removes the fence', () => {
    expect(
      markdownToPlainText(
        'config:\n\n```json\n{ "drawer": "rawBoxPlot" }\n```\n\nend',
      ),
    ).toBe('config:\n\n{ "drawer": "rawBoxPlot" }\n\nend')
  })

  test('flattens tables and drops the separator row', () => {
    expect(
      markdownToPlainText('| name | value |\n| --- | ---: |\n| a | 1 |'),
    ).toBe('name | value\na | 1')
  })

  test('drops horizontal rules', () => {
    expect(markdownToPlainText('above\n\n---\n\nbelow')).toBe('above\n\nbelow')
  })

  test('collapses runs of blank lines and trailing whitespace', () => {
    expect(markdownToPlainText('a\n\n\n\nb   \n')).toBe('a\n\nb')
  })

  test('does not mistake underscores inside words for emphasis', () => {
    // `file_name_here` must survive; a naive single-underscore rule eats it
    expect(markdownToPlainText('file_name_here')).toBe('file_name_here')
  })
})
