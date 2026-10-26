import { precomputedBoxPlotDrawer, rawBoxPlotDrawer } from './boxPlot.ts'

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
    get: (key: string) => {
      if (key === 'name') {
        return 'GENE1'
      }
      return undefined
    },
    toJSON: () => ({}),
  } as any,
  config: {} as any,
  theme: {},
}

describe('precomputedBoxPlotDrawer', () => {
  test('draws background panel and boxes from boxes array', () => {
    const width = 300
    const height = 200
    const ctx = createMockCanvasContext(width, height)

    void precomputedBoxPlotDrawer({
      ctx,
      width,
      height,
      data: {
        boxes: [
          { name: 'Brain', min: 0.1, q1: 1, median: 2, q3: 3, max: 5 },
          { name: 'Liver', min: 0.2, q1: 1.2, median: 2.2, q3: 3.2, max: 5.2 },
        ],
      },
      ...baseProps,
    })

    expect(ctx.fillRect).toHaveBeenCalled()
    expect(ctx.save).toHaveBeenCalled()
    expect(ctx.restore).toHaveBeenCalled()
  })

  test('returns early when no valid boxes are provided', () => {
    const ctx = createMockCanvasContext(200, 150)
    void precomputedBoxPlotDrawer({
      ctx,
      width: 200,
      height: 150,
      data: {
        tissues: {
          Brain: [1, 2, 3, 4, 5],
        },
      },
      ...baseProps,
    })

    expect(ctx.fillRect).not.toHaveBeenCalled()
  })
})

describe('rawBoxPlotDrawer', () => {
  test('draws background panel and boxes for each tissue', () => {
    const width = 300
    const height = 200
    const ctx = createMockCanvasContext(width, height)

    void rawBoxPlotDrawer({
      ctx,
      width,
      height,
      data: {
        tissues: {
          Brain: [1, 2, 3, 4, 5],
          Liver: [2, 3, 4, 5, 6],
        },
      },
      ...baseProps,
    })

    expect(ctx.fillRect).toHaveBeenCalled()
    expect(ctx.save).toHaveBeenCalled()
    expect(ctx.restore).toHaveBeenCalled()
  })

  test('returns early when no tissue data is provided', () => {
    const ctx = createMockCanvasContext(200, 150)
    void rawBoxPlotDrawer({
      ctx,
      width: 200,
      height: 150,
      data: {},
      ...baseProps,
    })

    expect(ctx.fillRect).not.toHaveBeenCalled()
  })

  test('ignores precomputed boxes and only reads raw tissues', () => {
    const ctx = createMockCanvasContext(200, 150)
    void rawBoxPlotDrawer({
      ctx,
      width: 200,
      height: 150,
      data: {
        boxes: [{ name: 'Brain', min: 0, q1: 1, median: 2, q3: 3, max: 4 }],
        tissues: {
          Brain: [10, 20, 30],
        },
      },
      ...baseProps,
    })

    expect(ctx.fillRect).toHaveBeenCalled()
  })
})
