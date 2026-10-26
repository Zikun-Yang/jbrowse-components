import { safeUrlTransform } from './markdownUrlTransform.ts'

describe('safeUrlTransform', () => {
  test('allows http, https, mailto and fragments', () => {
    expect(safeUrlTransform('https://example.com/a')).toBe(
      'https://example.com/a',
    )
    expect(safeUrlTransform('http://example.com')).toBe('http://example.com')
    expect(safeUrlTransform('mailto:someone@example.com')).toBe(
      'mailto:someone@example.com',
    )
    expect(safeUrlTransform('#section')).toBe('#section')
  })

  test('allows relative paths by default', () => {
    expect(safeUrlTransform('./track.bam')).toBe('./track.bam')
    expect(safeUrlTransform('data/track.bam')).toBe('data/track.bam')
    expect(safeUrlTransform('/data/track.bam')).toBe('/data/track.bam')
  })

  test('hides relative paths when hideUris is set', () => {
    expect(safeUrlTransform('./track.bam', true)).toBe('')
    expect(safeUrlTransform('data/track.bam', true)).toBe('')
    // remote links and fragments are not local uris
    expect(safeUrlTransform('https://example.com', true)).toBe(
      'https://example.com',
    )
    expect(safeUrlTransform('#section', true)).toBe('#section')
  })

  test('rejects javascript, data, file and other protocols', () => {
    expect(safeUrlTransform('javascript:alert(1)')).toBe('')
    expect(safeUrlTransform('JaVaScRiPt:alert(1)')).toBe('')
    expect(safeUrlTransform('data:text/html,<script>alert(1)</script>')).toBe(
      '',
    )
    expect(safeUrlTransform('file:///etc/passwd')).toBe('')
    expect(safeUrlTransform('vbscript:msgbox(1)')).toBe('')
    expect(safeUrlTransform('ftp://example.com')).toBe('')
  })

  test('rejects urls with control characters', () => {
    expect(safeUrlTransform('java\nscript:alert(1)')).toBe('')
    expect(safeUrlTransform(' https://example.com\u0000')).toBe('')
    expect(safeUrlTransform('')).toBe('')
  })
})
