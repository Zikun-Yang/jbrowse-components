import { barPlotDrawer } from './barPlot.ts'

jest.mock('d3-scale', () => ({
  scaleBand: () => {
    const scale = ((value: string) => {
      const domain = (scale as any).domainValue as string[]
      const index = domain.indexOf(value)
      return index * 40
    }) as any
    scale.domain = (d?: string[]) => {
      scale.domainValue = d ?? []
      return scale
    }
    scale.range = () => scale
    scale.padding = () => scale
    scale.bandwidth = () => 40
    return scale
  },
  scaleLinear: () => {
    const scale = ((value: number) => {
      const [min, max] = (scale as any).domainValue as [number, number]
      const [rMin, rMax] = (scale as any).rangeValue as [number, number]
      if (max === min) return rMin
      return rMax + ((value - min) / (max - min)) * (rMin - rMax)
    }) as any
    scale.domain = (d?: [number, number]) => {
      scale.domainValue = d ?? [0, 1]
      return scale
    }
    scale.range = (r?: [number, number]) => {
      scale.rangeValue = r ?? [0, 1]
      return scale
    }
    scale.nice = () => scale
    scale.ticks = () => {
      const [min, max] = (scale.domainValue as [number, number]) ?? [0, 1]
      return [min, (min + max) / 2, max]
    }
    return scale
  },
}))

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

describe('barPlotDrawer', () => {
  test('draws background panel and bars', () => {
    const ctx = createMockCanvasContext(300, 200)

    barPlotDrawer({
      ctx,
      width: 300,
      height: 200,
      data: {
        bars: [
          { name: 'Brain', value: 10 },
          { name: 'Liver', value: 20 },
        ],
      },
      ...baseProps,
    })

    expect(ctx.fillRect).toHaveBeenCalled()
    expect(ctx.strokeRect).toHaveBeenCalled()
    expect(ctx.save).toHaveBeenCalled()
    expect(ctx.restore).toHaveBeenCalled()
  })

  test('returns early when no bars are provided', () => {
    const ctx = createMockCanvasContext(200, 150)
    barPlotDrawer({
      ctx,
      width: 200,
      height: 150,
      data: {},
      ...baseProps,
    })

    expect(ctx.fillRect).not.toHaveBeenCalled()
  })
})
