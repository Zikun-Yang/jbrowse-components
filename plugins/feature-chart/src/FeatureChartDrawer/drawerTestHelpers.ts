import type { DrawerFunction, DrawerProps } from './types.ts'

/**
 * Recording stand-in for a 2D canvas context, shared by the drawer tests.
 *
 * `paintCount` counts only operations that put pixels on the canvas, so a test
 * can tell "the drawer drew nothing because the payload was missing" apart from
 * "the drawer threw".
 */
export interface RecordingContext {
  fillStyle: string
  strokeStyle: string
  lineWidth: number
  font: string
  textAlign: string
  textBaseline: string
  paintCount: number
  calls: string[]
  beginPath: () => void
  closePath: () => void
  arc: () => void
  rect: () => void
  clip: () => void
  fill: () => void
  fillRect: () => void
  stroke: () => void
  strokeRect: () => void
  fillText: () => void
  moveTo: () => void
  lineTo: () => void
  translate: () => void
  save: () => void
  restore: () => void
}

export function createRecordingContext(): RecordingContext {
  const record = (name: string, paints = true) => {
    const fn = () => {
      ctx.calls.push(name)
      if (paints) {
        ctx.paintCount++
      }
    }
    return fn
  }
  const ctx: RecordingContext = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: '',
    textBaseline: '',
    paintCount: 0,
    calls: [],
    beginPath: record('beginPath', false),
    closePath: record('closePath', false),
    arc: record('arc', false),
    rect: record('rect', false),
    clip: record('clip', false),
    fill: record('fill'),
    fillRect: record('fillRect'),
    stroke: record('stroke'),
    strokeRect: record('strokeRect'),
    fillText: record('fillText'),
    moveTo: record('moveTo', false),
    lineTo: record('lineTo', false),
    translate: record('translate', false),
    save: record('save', false),
    restore: record('restore', false),
  }
  return ctx
}

export function createDrawerProps(
  ctx: RecordingContext,
  data: unknown,
  extra: Partial<DrawerProps> = {},
): DrawerProps {
  return {
    ctx: ctx as unknown as CanvasRenderingContext2D,
    width: 120,
    height: 180,
    data,
    name: 'GENE_A',
    region: { refName: 'ctgA', start: 1000, end: 1100, assemblyName: 'volvox' },
    bpPerPx: 1,
    feature: { get: () => undefined, id: () => 'f1' } as never,
    config: {} as never,
    theme: {} as never,
    ...extra,
  }
}

/** Draw once and report how many painting operations landed on the canvas. */
export function paintCountFor(draw: DrawerFunction, data: unknown) {
  const ctx = createRecordingContext()
  void draw(createDrawerProps(ctx, data))
  return ctx.paintCount
}
