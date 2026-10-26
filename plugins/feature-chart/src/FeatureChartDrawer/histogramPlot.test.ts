import { histogramPlotDrawer } from './histogramPlot.ts'

function createMockCanvasContext(width: number, height: number) {
  const ctx = {
    canvas: { width, height },
    save: jest.fn(),
    restore: jest.fn(),
    scale: jest.fn(),
    translate: jest.fn(),
    beginPath: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    stroke: jest.fn(),
    fillRect: jest.fn(),
    strokeRect: jest.fn(),
    fillText: jest.fn(),
    rect: jest.fn(),
    clip: jest.fn(),
    clearRect: jest.fn(),
  } as unknown as CanvasRenderingContext2D
  return ctx
}

const baseProps = {
  name: 'GENE1',
  region: {
    refName: 'chr1',
    start: 0,
    end: 1000,
    assemblyName: 'hg38',
  },
  bpPerPx: 1,
  feature: {
    id: () => 'f1',
    get: () => undefined,
    toJSON: () => ({}),
  } as any,
  config: {} as any,
  theme: {},
}

describe('histogramPlotDrawer', () => {
  test('draws background panel and histogram bars', () => {
    const ctx = createMockCanvasContext(300, 200)

    void histogramPlotDrawer({
      ctx,
      width: 300,
      height: 200,
      data: {
        values: [1, 2, 2, 3, 3, 3, 4, 4, 5],
        bins: 4,
      },
      ...baseProps,
    })

    expect(ctx.fillRect).toHaveBeenCalled()
    expect(ctx.strokeRect).toHaveBeenCalled()
    expect(ctx.save).toHaveBeenCalled()
    expect(ctx.restore).toHaveBeenCalled()
  })

  test('returns early when no values are provided', () => {
    const ctx = createMockCanvasContext(200, 150)
    void histogramPlotDrawer({
      ctx,
      width: 200,
      height: 150,
      data: {},
      ...baseProps,
    })

    expect(ctx.fillRect).not.toHaveBeenCalled()
  })
})
