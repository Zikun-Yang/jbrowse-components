/**
 * Minimal, dependency-free replacements for the two d3-scale primitives the
 * drawers use.
 *
 * `d3-scale` v4 is ESM-only, and the repo's babel config deliberately ignores
 * `node_modules` (jest and webpack both rely on that). Because the plugin is
 * now imported by every product entry point, a static `d3-scale` import would
 * make product test suites fail on "Unexpected token 'export'". Keeping the
 * two scales local removes the dependency entirely.
 *
 * The math follows d3-scale/d3-array so chart geometry and axis ticks stay the
 * same: band padding, `nice()` on a 10-tick step, and d3's tick step
 * thresholds (sqrt(2), sqrt(10), sqrt(50)).
 */

const E2 = Math.SQRT2
const E5 = Math.sqrt(10)
const E10 = Math.sqrt(50)

export interface BandScale {
  (value: string): number | undefined
  domain(values: string[]): BandScale
  range(range: [number, number]): BandScale
  /** d3 semantics: sets inner and outer padding to the same value. */
  padding(padding: number): BandScale
  bandwidth(): number
}

/**
 * Categorical scale: maps a category name to the left edge of its band.
 * Mirrors `d3.scaleBand()` with `align = 0.5`.
 */
export function scaleBand(): BandScale {
  let domain: string[] = []
  let range: [number, number] = [0, 1]
  let paddingInner = 0
  let paddingOuter = 0

  function reverseIndex(index: number, count: number) {
    return range[1] < range[0] ? count - 1 - index : index
  }

  function layout() {
    const n = domain.length
    const [rangeStart, rangeStop] = range
    const reverse = rangeStop < rangeStart
    const start = reverse ? rangeStop : rangeStart
    const stop = reverse ? rangeStart : rangeStop
    const step =
      (stop - start) / Math.max(1, n - paddingInner + paddingOuter * 2)
    // align = 0.5 centers the bands inside the range
    const origin = start + (stop - start - step * (n - paddingInner)) * 0.5
    return { step, origin, bandwidth: step * (1 - paddingInner) }
  }

  const scale = ((value: string) => {
    const index = domain.indexOf(value)
    if (index === -1) {
      return undefined
    }
    const { step, origin } = layout()
    // A reversed range flips the band order, like d3 does
    return origin + step * reverseIndex(index, domain.length)
  }) as BandScale

  scale.domain = values => {
    domain = [...values]
    return scale
  }
  scale.range = nextRange => {
    range = nextRange
    return scale
  }
  scale.padding = padding => {
    paddingInner = padding
    paddingOuter = padding
    return scale
  }
  scale.bandwidth = () => layout().bandwidth

  return scale
}

export interface LinearScale {
  (value: number): number
  domain(domain: [number, number]): LinearScale
  range(range: [number, number]): LinearScale
  /** Round the domain outward to visually nice values (d3 default: 10 ticks). */
  nice(count?: number): LinearScale
  ticks(count?: number): number[]
}

/** d3-array `tickStep`: the step between nice ticks, sign following the domain. */
function tickStep(start: number, stop: number, count: number): number {
  const step0 = Math.abs(stop - start) / Math.max(0, count)
  const power = Math.floor(Math.log(step0) / Math.LN10)
  const error = step0 / 10 ** power
  const factor = error >= E10 ? 10 : error >= E5 ? 5 : error >= E2 ? 2 : 1
  const step = factor * 10 ** power
  return stop < start ? -step : step
}

/** d3-array `ticks`: nice, step-aligned tick values inside `[start, stop]`. */
export function tickValues(
  start: number,
  stop: number,
  count: number,
): number[] {
  const reverse = stop < start
  const from = reverse ? stop : start
  const to = reverse ? start : stop
  const step = tickStep(from, to, count)

  if (step === 0 || !Number.isFinite(step)) {
    return []
  }

  const first = Math.ceil(from / step)
  const last = Math.floor(to / step)
  const values: number[] = []
  for (let i = first; i <= last; i++) {
    // toPrecision avoids 0.30000000000000004 style noise from `step`
    values.push(Number((i * step).toPrecision(12)))
  }
  return reverse ? values.reverse() : values
}

/**
 * Continuous scale: maps a value domain to a pixel range (usually inverted for
 * y axes). Mirrors `d3.scaleLinear()`.
 */
export function scaleLinear(): LinearScale {
  let domain: [number, number] = [0, 1]
  let range: [number, number] = [0, 1]

  const scale = ((value: number) => {
    const [d0, d1] = domain
    const [r0, r1] = range
    if (d1 === d0) {
      return r0
    }
    return r0 + ((value - d0) / (d1 - d0)) * (r1 - r0)
  }) as LinearScale

  scale.domain = nextDomain => {
    domain = nextDomain
    return scale
  }
  scale.range = nextRange => {
    range = nextRange
    return scale
  }
  scale.nice = (count = 10) => {
    const [d0, d1] = domain
    const step = tickStep(d0, d1, count)
    if (step > 0) {
      domain = [Math.floor(d0 / step) * step, Math.ceil(d1 / step) * step]
    } else if (step < 0) {
      domain = [Math.ceil(d0 / step) * step, Math.floor(d1 / step) * step]
    }
    return scale
  }
  scale.ticks = (count = 10) => tickValues(domain[0], domain[1], count)

  return scale
}
