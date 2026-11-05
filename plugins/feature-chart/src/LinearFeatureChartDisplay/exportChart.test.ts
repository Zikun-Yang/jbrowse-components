import {
  canvasPngDataUrl,
  canvasSvgDocument,
  chartExportFileName,
  dataUrlByteLength,
  downloadDataUrl,
  plotlyExportDataUrl,
  sanitizeFilePart,
  svgDataUrl,
} from './exportChart.ts'

describe('sanitizeFilePart', () => {
  test('keeps letters, digits, dots, dashes and underscores', () => {
    expect(sanitizeFilePart('chr1_gene-2.5', 'x')).toBe('chr1_gene-2.5')
  })

  test('collapses path separators, spaces and quotes', () => {
    expect(sanitizeFilePart('a/b c"d:e', 'x')).toBe('a-b-c-d-e')
  })

  test('keeps non-latin letters readable', () => {
    expect(sanitizeFilePart('大脑 TPM', 'x')).toBe('大脑-TPM')
  })

  test('falls back when nothing usable is left', () => {
    expect(sanitizeFilePart('///', 'chart')).toBe('chart')
  })

  test('caps the length', () => {
    expect(sanitizeFilePart('a'.repeat(200), 'x')).toHaveLength(60)
  })
})

describe('chartExportFileName', () => {
  test('carries trackId, feature name and format', () => {
    expect(
      chartExportFileName({
        trackId: 'tissue_expression',
        featureName: 'GENE A',
        format: 'png',
      }),
    ).toBe('tissue_expression-GENE-A.png')
  })

  test('adds the view suffix so the two backends do not overwrite each other', () => {
    expect(
      chartExportFileName({
        trackId: 't',
        featureName: 'f',
        format: 'svg',
        suffix: 'interactive',
      }),
    ).toBe('t-f-interactive.svg')
  })
})

describe('dataUrl helpers', () => {
  test('dataUrlByteLength counts base64 payload bytes', () => {
    // "hello" → aGVsbG8=
    expect(dataUrlByteLength('data:text/plain;base64,aGVsbG8=')).toBe(5)
    expect(dataUrlByteLength('data:image/svg+xml,%3Csvg%2F%3E')).toBe(6)
    expect(dataUrlByteLength('not-a-data-url')).toBe(0)
  })

  test('canvasSvgDocument keeps the CSS size and embeds the raster', () => {
    const png = 'data:image/png;base64,iVBORw0KGgo='
    const svg = canvasSvgDocument(png, { width: 800, height: 400 })
    expect(svg).toContain('width="800" height="400"')
    expect(svg).toContain('viewBox="0 0 800 400"')
    expect(svg).toContain('href="data:image/png;base64,')
    expect(svgDataUrl(svg)).toContain('data:image/svg+xml')
  })

  test('canvasPngDataUrl returns the canvas raster', () => {
    const canvas = {
      toDataURL: jest.fn(() => 'data:image/png;base64,AAAA'),
    } as unknown as HTMLCanvasElement
    expect(canvasPngDataUrl(canvas)).toBe('data:image/png;base64,AAAA')
    expect(canvas.toDataURL).toHaveBeenCalledWith('image/png')
  })

  test('downloadDataUrl clicks an anchor and reports the byte count', () => {
    const clicked: { filename: string; href: string }[] = []
    const createElement = (): HTMLAnchorElement => {
      const anchor = {
        style: {},
        download: '',
        href: '',
        click: () => {
          clicked.push({ filename: anchor.download, href: anchor.href })
        },
        remove: () => {},
      } as unknown as HTMLAnchorElement
      return anchor
    }
    const doc = {
      body: { append: () => {} },
      createElement,
    } as unknown as Document
    const bytes = downloadDataUrl(
      'data:image/png;base64,aGVsbG8=',
      'x.png',
      doc,
    )
    expect(bytes).toBe(5)
    expect(clicked).toEqual([
      { filename: 'x.png', href: 'data:image/png;base64,aGVsbG8=' },
    ])
  })
})

describe('plotlyExportDataUrl', () => {
  test('sets the layout size, passes scale and returns the data URL', async () => {
    const relayout = jest.fn().mockResolvedValue(undefined)
    const toImage = jest.fn().mockResolvedValue('data:image/png;base64,AAAA')
    const node = {} as HTMLElement
    const url = await plotlyExportDataUrl(
      { node, plotly: { relayout, toImage } as never },
      { format: 'png', width: 640, height: 320 },
    )
    expect(relayout).toHaveBeenCalledWith(node, { width: 640, height: 320 })
    expect(toImage).toHaveBeenCalledWith(node, {
      format: 'png',
      width: 640,
      height: 320,
      scale: 2,
    })
    expect(url).toContain('data:image/png')
  })

  test('svg goes through the same path', async () => {
    const toImage = jest
      .fn()
      .mockResolvedValue('data:image/svg+xml,%3Csvg%2F%3E')
    const url = await plotlyExportDataUrl(
      {
        node: {} as HTMLElement,
        plotly: { relayout: jest.fn(), toImage } as never,
      },
      { format: 'svg', width: 100, height: 50, scale: 1 },
    )
    expect(url).toContain('svg')
    expect(toImage.mock.calls[0]![1]).toMatchObject({ format: 'svg', scale: 1 })
  })
})
