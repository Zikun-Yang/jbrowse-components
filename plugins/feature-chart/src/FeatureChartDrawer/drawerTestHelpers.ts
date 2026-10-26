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
  globalAlpha: number
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
  rotate: () => void
  measureText: (text: string) => { width: number }
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
    globalAlpha: 1,
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
    rotate: record('rotate', false),
    // 5px per character is enough for `wrapText` to break lines predictably.
    measureText: (text: string) => ({ width: text.length * 5 }),
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
export function paintCountFor(
  draw: DrawerFunction,
  data: unknown,
  extra: Partial<DrawerProps> = {},
) {
  const ctx = createRecordingContext()
  void draw(createDrawerProps(ctx, data, extra))
  return ctx.paintCount
}

/**
 * Context that records every drawing call **with its arguments and with the
 * canvas state at the time**, which is what "the legacy drawer and its spec
 * equivalent render the same picture" actually means.
 *
 * `paintCount` cannot tell `fillRect(0,0,10,10)` from `fillRect(80,160,5,5)`.
 */
export interface TracingContext {
  ctx: CanvasRenderingContext2D
  events: unknown[]
}

const TRACED_METHODS = [
  'beginPath',
  'closePath',
  'arc',
  'rect',
  'clip',
  'fill',
  'fillRect',
  'stroke',
  'strokeRect',
  'fillText',
  'moveTo',
  'lineTo',
  'translate',
  'rotate',
  'save',
  'restore',
] as const

const TRACED_STATE = [
  'fillStyle',
  'strokeStyle',
  'lineWidth',
  'font',
  'textAlign',
  'textBaseline',
  'globalAlpha',
] as const

export function createTracingContext(): TracingContext {
  const events: unknown[] = []
  const state: Record<string, unknown> = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: 'start',
    textBaseline: 'alphabetic',
    globalAlpha: 1,
  }
  const target: Record<string, unknown> = {}

  for (const key of TRACED_STATE) {
    Object.defineProperty(target, key, {
      get: () => state[key],
      set: (value: unknown) => {
        state[key] = value
        events.push([`set:${key}`, value])
      },
      enumerable: true,
      configurable: true,
    })
  }

  for (const name of TRACED_METHODS) {
    target[name] = (...args: unknown[]) => {
      events.push([name, ...args])
    }
  }
  target.measureText = (text: string) => ({ width: text.length * 5 })

  return { ctx: target as unknown as CanvasRenderingContext2D, events }
}

/** Draw once and return the full trace. */
export function traceDraw(
  draw: DrawerFunction,
  data: unknown,
  extra: Partial<DrawerProps> = {},
): unknown[] {
  const { ctx, events } = createTracingContext()
  void draw({
    ...createDrawerProps(createRecordingContext(), data, extra),
    ctx,
  })
  return events
}
