import BED from '@gmod/bed'

import { featureData2, itemRgbToCssColor, normalizeBedScore } from './util.ts'

// a BED12 line that looks like a gene (has thickStart, blockCount, strand)
function makeTranscriptLikeInput() {
  return {
    splitLine: [
      'chr1',
      '1000',
      '2000',
      'feat1',
      '100',
      '+',
      '1100',
      '1900',
      '0',
      '3',
      '200,300,200,',
      '0,400,800,',
    ],
    refName: 'chr1',
    start: 1000,
    end: 2000,
    parser: new BED(),
    uniqueId: 'test-1',
    scoreColumn: '',
  }
}

describe('featureData2', () => {
  it('produces transcript subfeatures by default for BED12 gene-like data', () => {
    const result = featureData2(makeTranscriptLikeInput())
    expect(result.type).toBe('mRNA')
    const types = result.subfeatures?.map(s => s.type)
    expect(types).toContain('CDS')
  })

  it('skips transcript heuristic when disableGeneHeuristic is true', () => {
    const result = featureData2({
      ...makeTranscriptLikeInput(),
      disableGeneHeuristic: true,
    })
    expect(result.type).toBeUndefined()
    const types = result.subfeatures?.map(s => s.type)
    expect(types).not.toContain('CDS')
    expect(types).not.toContain('five_prime_UTR')
    expect(types).not.toContain('three_prime_UTR')
    // should still have block subfeatures
    expect(types).toEqual(['block', 'block', 'block'])
  })

  it('normalizes the BED itemRgb column into a css `color` field', () => {
    const result = featureData2({
      splitLine: [
        'chr1',
        '1000',
        '2000',
        'feat1',
        '750',
        '+',
        '1100',
        '1900',
        '255,0,0',
        '1',
        '1000',
        '0',
      ],
      refName: 'chr1',
      start: 1000,
      end: 2000,
      parser: new BED(),
      uniqueId: 'test-3',
      scoreColumn: '',
    })
    expect(result.color).toBe('rgb(255, 0, 0)')
    // the original column is preserved for backwards compatibility
    expect(result.itemRgb).toBe('255,0,0')
    expect(result.scoreNormalized).toBe(0.75)
  })

  it('normalizes the autosql `reserved` itemRgb alias', () => {
    const result = featureData2({
      splitLine: [
        'chr1',
        '1000',
        '2000',
        'feat1',
        '0',
        '+',
        '1100',
        '1900',
        '12,34,56',
      ],
      refName: 'chr1',
      start: 1000,
      end: 2000,
      parser: new BED({
        autoSql: `table test\n"test"\n(\nstring chrom; "chrom"\nuint chromStart; "start"\nuint chromEnd; "end"\nstring name; "name"\nuint score; "score"\nchar[1] strand; "strand"\nuint thickStart; "thickStart"\nuint thickEnd; "thickEnd"\nuint reserved; "Used as itemRgb as of 2004-11-22"\n)`,
      }),
      uniqueId: 'test-4',
      scoreColumn: '',
    })
    expect(result.reserved).toBe('12,34,56')
    expect(result.color).toBe('rgb(12, 34, 56)')
  })

  it('does not overwrite an existing color field from the data', () => {
    const result = featureData2({
      splitLine: ['chr1', '1000', '2000', 'feat1', '100', '+', '0', '0', '1'],
      refName: 'chr1',
      start: 1000,
      end: 2000,
      parser: new BED(),
      uniqueId: 'test-5',
      scoreColumn: '',
      // column 9 is mapped to a user-provided `color` column
      names: [
        'chrom',
        'chromStart',
        'chromEnd',
        'name',
        'score',
        'strand',
        'thickStart',
        'thickEnd',
        'color',
      ],
    })
    expect(result.color).toBe('1')
  })

  it('omits scoreNormalized when no score is present', () => {
    const result = featureData2({
      splitLine: ['chr1', '10', '20', 'noscore'],
      refName: 'chr1',
      start: 10,
      end: 20,
      parser: new BED(),
      uniqueId: 'test-6',
      scoreColumn: '',
    })
    expect(result.scoreNormalized).toBeUndefined()
    expect(result.color).toBeUndefined()
  })
})

describe('itemRgbToCssColor', () => {
  it('parses a triplet and clamps out of range values', () => {
    expect(itemRgbToCssColor('0, 128, 255')).toBe('rgb(0, 128, 255)')
    expect(itemRgbToCssColor('300,-5,12')).toBe('rgb(255, 0, 12)')
  })

  it('returns undefined for malformed values', () => {
    expect(itemRgbToCssColor(undefined)).toBeUndefined()
    expect(itemRgbToCssColor('')).toBeUndefined()
    expect(itemRgbToCssColor('1,2')).toBeUndefined()
    expect(itemRgbToCssColor('a,b,c')).toBeUndefined()
    expect(itemRgbToCssColor('#ff0000')).toBeUndefined()
  })
})

describe('normalizeBedScore', () => {
  it('normalizes the 0-1000 BED score range', () => {
    expect(normalizeBedScore(0)).toBe(0)
    expect(normalizeBedScore(500)).toBe(0.5)
    expect(normalizeBedScore(1000)).toBe(1)
  })

  it('clamps out of range and ignores missing scores', () => {
    expect(normalizeBedScore(2000)).toBe(1)
    expect(normalizeBedScore(-10)).toBe(0)
    expect(normalizeBedScore(undefined)).toBeUndefined()
    expect(normalizeBedScore(Number.NaN)).toBeUndefined()
  })
})
