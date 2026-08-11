import { MismatchParser } from '@jbrowse/plugin-alignments'

import type { Feature } from '@jbrowse/core/util'

const { parseCigar } = MismatchParser

export interface Anchor {
  refName: string
  coord: number
}

export interface Viewport {
  start: number
  end: number
}

export interface Window {
  refName: string
  start: number
  end: number
}

export interface WeightedWindow extends Window {
  // total source-side aligned overlap that mapped onto refName: the sum of
  // the overlapping segment lengths, NOT the displayed envelope span, so a
  // chromosome whose envelope is inflated by two distant blocks (a1 --- a2)
  // is not over-counted
  weight: number
}

interface IndexEntry {
  topRef: string
  topStart: number
  topEnd: number
  botRef: string
  botStart: number
  botEnd: number
  strand: number
  cigar: string[] | undefined
}

interface RefIndex {
  starts: number[]
  // ends[i] = end of entries[i] on this side
  ends: number[]
  // maxEnd[i] = max(ends[0..i]); non-decreasing, lets binary search
  // skip entries that end before the query coord
  maxEnd: number[]
  entries: IndexEntry[]
}

export interface LevelIndex {
  top: Map<string, RefIndex>
  bot: Map<string, RefIndex>
}

export type Canonicalize = (assemblyName: string, refName: string) => string

const indexCache = new WeakMap<Feature[], LevelIndex>()

// walk the CIGAR consuming `startX` bp along the feature (top) axis,
// returns how far that gets along each axis
export function findPosInCigar(cigar: string[], startX: number) {
  let featX = 0
  let mateX = 0
  for (let i = 0; i < cigar.length; i += 2) {
    if (featX >= startX) {
      break
    }
    const len = +cigar[i]!
    const op = cigar[i + 1]!
    const min = Math.min(len, startX - featX)
    if (op === 'I') {
      mateX += len
    } else if (op === 'D') {
      featX += min
    } else if (op === 'M' || op === '=' || op === 'X') {
      mateX += min
      featX += min
    }
  }
  return [featX, mateX] as const
}

// symmetric walk: consume `startX` bp along the mate (bottom) axis,
// returns how far that gets along each axis
export function findMatePosInCigar(cigar: string[], startX: number) {
  let featX = 0
  let mateX = 0
  for (let i = 0; i < cigar.length; i += 2) {
    if (mateX >= startX) {
      break
    }
    const len = +cigar[i]!
    const op = cigar[i + 1]!
    const min = Math.min(len, startX - mateX)
    if (op === 'I') {
      mateX += min
    } else if (op === 'D') {
      featX += len
    } else if (op === 'M' || op === '=' || op === 'X') {
      mateX += min
      featX += min
    }
  }
  return [mateX, featX] as const
}

function makeRefIndex(entries: IndexEntry[], side: 'top' | 'bot'): RefIndex {
  const sorted = [...entries].sort((a, b) =>
    side === 'top' ? a.topStart - b.topStart : a.botStart - b.botStart,
  )
  const starts = sorted.map(e => (side === 'top' ? e.topStart : e.botStart))
  const ends = sorted.map(e => (side === 'top' ? e.topEnd : e.botEnd))
  const maxEnd: number[] = []
  let max = -Infinity
  for (const end of ends) {
    max = Math.max(max, end)
    maxEnd.push(max)
  }
  return { starts, ends, maxEnd, entries: sorted }
}

export function buildLevelIndex(
  features: Feature[],
  canonicalize: Canonicalize,
): LevelIndex {
  const cached = indexCache.get(features)
  if (cached) {
    return cached
  }
  const topEntries = new Map<string, IndexEntry[]>()
  const botEntries = new Map<string, IndexEntry[]>()
  for (const f of features) {
    const mate = f.get('mate') as
      | { start: number; end: number; refName: string; assemblyName: string }
      | undefined
    if (!mate) {
      continue
    }
    const cigarStr = f.get('CIGAR') as string | undefined
    const entry: IndexEntry = {
      topRef: canonicalize(f.get('assemblyName'), f.get('refName')),
      topStart: f.get('start'),
      topEnd: f.get('end'),
      botRef: canonicalize(mate.assemblyName, mate.refName),
      botStart: mate.start,
      botEnd: mate.end,
      strand: f.get('strand') === -1 ? -1 : 1,
      cigar: cigarStr ? parseCigar(cigarStr) : undefined,
    }
    const te = topEntries.get(entry.topRef)
    if (te) {
      te.push(entry)
    } else {
      topEntries.set(entry.topRef, [entry])
    }
    const be = botEntries.get(entry.botRef)
    if (be) {
      be.push(entry)
    } else {
      botEntries.set(entry.botRef, [entry])
    }
  }
  const index: LevelIndex = {
    top: new Map(
      [...topEntries].map(([ref, entries]) => [
        ref,
        makeRefIndex(entries, 'top'),
      ]),
    ),
    bot: new Map(
      [...botEntries].map(([ref, entries]) => [
        ref,
        makeRefIndex(entries, 'bot'),
      ]),
    ),
  }
  indexCache.set(features, index)
  return index
}

function findCovering(refIndex: RefIndex, coord: number) {
  const { starts, ends, maxEnd, entries } = refIndex
  // rightmost entry with start <= coord
  let lo = 0
  let hi = starts.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (starts[mid]! <= coord) {
      lo = mid + 1
    } else {
      hi = mid
    }
  }
  const right = lo - 1
  if (right < 0) {
    return []
  }
  // leftmost index whose maxEnd reaches coord; anything earlier ends too soon
  lo = 0
  hi = right
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (maxEnd[mid]! >= coord) {
      hi = mid
    } else {
      lo = mid + 1
    }
  }
  const result = []
  for (let i = lo; i <= right; i++) {
    if (ends[i]! >= coord) {
      result.push(entries[i]!)
    }
  }
  return result
}

// all entries overlapping [start, end]: same binary-search scaffolding as
// findCovering but collecting every entry with entryStart <= end and
// entryEnd >= start
function findOverlapping(refIndex: RefIndex, start: number, end: number) {
  const { starts, ends, maxEnd, entries } = refIndex
  // rightmost entry with start <= end
  let lo = 0
  let hi = starts.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (starts[mid]! <= end) {
      lo = mid + 1
    } else {
      hi = mid
    }
  }
  const right = lo - 1
  if (right < 0) {
    return []
  }
  // leftmost index whose maxEnd reaches start; anything earlier ends too soon
  lo = 0
  hi = right
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (maxEnd[mid]! >= start) {
      hi = mid
    } else {
      lo = mid + 1
    }
  }
  const result = []
  for (let i = lo; i <= right; i++) {
    if (ends[i]! >= start) {
      result.push(entries[i]!)
    }
  }
  return result
}

function mapTopToBot(entry: IndexEntry, coord: number) {
  const offset = coord - entry.topStart
  if (entry.cigar) {
    const [, mateX] = findPosInCigar(entry.cigar, offset)
    return entry.strand === -1 ? entry.botEnd - mateX : entry.botStart + mateX
  }
  const frac = Math.min(
    1,
    Math.max(0, offset / (entry.topEnd - entry.topStart)),
  )
  return entry.strand === -1
    ? entry.botEnd - frac * (entry.botEnd - entry.botStart)
    : entry.botStart + frac * (entry.botEnd - entry.botStart)
}

function mapBotToTop(entry: IndexEntry, coord: number) {
  // distance along the alignment's mate axis: for inversions the mate axis
  // runs from botEnd down to botStart
  const botOffset =
    entry.strand === -1 ? entry.botEnd - coord : coord - entry.botStart
  if (entry.cigar) {
    const [, featX] = findMatePosInCigar(entry.cigar, botOffset)
    return entry.topStart + featX
  }
  const frac = Math.min(
    1,
    Math.max(0, botOffset / (entry.botEnd - entry.botStart)),
  )
  return entry.topStart + frac * (entry.topEnd - entry.topStart)
}

function pickBest(
  covering: IndexEntry[],
  side: 'top' | 'bot',
  viewport?: Viewport,
) {
  let best = covering[0]!
  let bestScore = -Infinity
  let bestSpan = Infinity
  for (const e of covering) {
    const start = side === 'top' ? e.topStart : e.botStart
    const end = side === 'top' ? e.topEnd : e.botEnd
    // prefer the feature covering the most of what the user is looking at,
    // breaking ties (e.g. nested features) towards the shorter, more
    // specific feature; without a viewport prefer the longest feature
    const score = viewport
      ? Math.min(end, viewport.end) - Math.max(start, viewport.start)
      : end - start
    const span = end - start
    if (
      score > bestScore ||
      (score === bestScore && viewport && span < bestSpan)
    ) {
      bestScore = score
      bestSpan = span
      best = e
    }
  }
  return best
}

export function mapAnchor(
  index: LevelIndex,
  side: 'top' | 'bot',
  anchor: Anchor,
  viewport?: Viewport,
): Anchor | undefined {
  const refIndex = (side === 'top' ? index.top : index.bot).get(anchor.refName)
  if (!refIndex) {
    return undefined
  }
  const covering = findCovering(refIndex, anchor.coord)
  if (!covering.length) {
    return undefined
  }
  const best = pickBest(covering, side, viewport)
  return {
    refName: side === 'top' ? best.botRef : best.topRef,
    coord:
      side === 'top'
        ? mapTopToBot(best, anchor.coord)
        : mapBotToTop(best, anchor.coord),
  }
}

// lift a whole visible window to the other side: every feature overlapping
// the window contributes the exact mapping of its overlapping segment
// (CIGAR walk when available, clamped linear interpolation otherwise;
// inversion edges come out swapped and are normalized per segment to
// [min, max]). segments are then merged into one [min, max] envelope per
// target chromosome, so a source window spanning several synteny blocks —
// e.g. a whole chromosome — maps to the full syntenic extent, possibly
// across multiple target chromosomes. each envelope also accumulates the
// source-side overlap length as its weight. returns [] when nothing
// overlaps
export function mapWindowWeighted(
  index: LevelIndex,
  side: 'top' | 'bot',
  window: Window,
): WeightedWindow[] {
  const refIndex = (side === 'top' ? index.top : index.bot).get(window.refName)
  if (!refIndex) {
    return []
  }
  const overlapping = findOverlapping(refIndex, window.start, window.end)
  if (!overlapping.length) {
    return []
  }
  const map = side === 'top' ? mapTopToBot : mapBotToTop
  const envelopes = new Map<
    string,
    { start: number; end: number; weight: number }
  >()
  for (const entry of overlapping) {
    const segStart = Math.max(
      window.start,
      side === 'top' ? entry.topStart : entry.botStart,
    )
    const segEnd = Math.min(
      window.end,
      side === 'top' ? entry.topEnd : entry.botEnd,
    )
    const m1 = map(entry, segStart)
    const m2 = map(entry, segEnd)
    const refName = side === 'top' ? entry.botRef : entry.topRef
    const lo = Math.min(m1, m2)
    const hi = Math.max(m1, m2)
    const existing = envelopes.get(refName)
    if (existing) {
      existing.start = Math.min(existing.start, lo)
      existing.end = Math.max(existing.end, hi)
      existing.weight += segEnd - segStart
    } else {
      envelopes.set(refName, { start: lo, end: hi, weight: segEnd - segStart })
    }
  }
  return [...envelopes].map(([refName, { start, end, weight }]) => ({
    refName,
    start,
    end,
    weight,
  }))
}

export function mapWindow(
  index: LevelIndex,
  side: 'top' | 'bot',
  window: Window,
): Window[] {
  return mapWindowWeighted(index, side, window).map(
    ({ refName, start, end }) => ({ refName, start, end }),
  )
}

// keep the smallest set of top-weight chromosomes whose cumulative weight
// reaches `pct`% of the total weight; the largest-weight chromosome is
// always kept, so a non-empty input never produces an empty result.
// preserves the input order of the kept windows
export function filterTopCumulative(
  windows: WeightedWindow[],
  pct: number,
): WeightedWindow[] {
  if (pct >= 100 || windows.length <= 1) {
    return windows
  }
  const total = windows.reduce((sum, w) => sum + w.weight, 0)
  if (total <= 0) {
    return windows
  }
  const threshold = (pct / 100) * total
  const sorted = [...windows].sort((a, b) => b.weight - a.weight)
  const keep = new Set<WeightedWindow>()
  let cumulative = 0
  for (const w of sorted) {
    keep.add(w)
    cumulative += w.weight
    if (cumulative >= threshold) {
      break
    }
  }
  return windows.filter(w => keep.has(w))
}

export interface LevelIndexPair {
  // built from features fetched over views[level]'s blocks: top = views[level]
  // coords, bot = views[level + 1] coords
  fwd?: LevelIndex
  // built from features fetched over views[level + 1]'s blocks (the adapter
  // auto-flips orientation when queried from the other assembly): top =
  // views[level + 1] coords, bot = views[level] coords
  rev?: LevelIndex
}

export function computeFollowTargets({
  sourceIndex,
  source,
  levelIndexes,
  maxCumulativePct = 100,
}: {
  sourceIndex: number
  source: Window
  levelIndexes: (LevelIndexPair | undefined)[]
  maxCumulativePct?: number
}) {
  const targets = new Map<number, Window[]>()
  let current: WeightedWindow[] = [
    { ...source, weight: source.end - source.start },
  ]
  for (let level = sourceIndex; level < levelIndexes.length; level++) {
    const pair = levelIndexes[level]
    // mapping views[level] -> views[level+1]: fwd's top side is keyed by
    // views[level] refs; rev's bot side shares that key space and is the
    // fallback when only reverse coverage is available
    const index = pair?.fwd ?? pair?.rev
    const side = pair?.fwd ? 'top' : 'bot'
    const mapped = index
      ? filterTopCumulative(
          mergeWeighted(
            current.flatMap(w => mapWindowWeighted(index, side, w)),
          ),
          maxCumulativePct,
        )
      : []
    if (!mapped.length) {
      break
    }
    targets.set(level + 1, mapped.map(stripWeight))
    current = mapped
  }
  current = [{ ...source, weight: source.end - source.start }]
  for (let level = sourceIndex - 1; level >= 0; level--) {
    const pair = levelIndexes[level]
    // mapping views[level+1] -> views[level]: rev's top side is keyed by
    // views[level+1] refs; fwd's bot side shares that key space and is the
    // fallback when only forward coverage is available
    const index = pair?.rev ?? pair?.fwd
    const side = pair?.rev ? 'top' : 'bot'
    const mapped = index
      ? filterTopCumulative(
          mergeWeighted(
            current.flatMap(w => mapWindowWeighted(index, side, w)),
          ),
          maxCumulativePct,
        )
      : []
    if (!mapped.length) {
      break
    }
    targets.set(level, mapped.map(stripWeight))
    current = mapped
  }
  return targets
}

function stripWeight({ refName, start, end }: WeightedWindow): Window {
  return { refName, start, end }
}

function mergeWeighted(windows: WeightedWindow[]): WeightedWindow[] {
  const envelopes = new Map<string, WeightedWindow>()
  for (const w of windows) {
    const existing = envelopes.get(w.refName)
    if (existing) {
      existing.start = Math.min(existing.start, w.start)
      existing.end = Math.max(existing.end, w.end)
      existing.weight += w.weight
    } else {
      envelopes.set(w.refName, { ...w })
    }
  }
  return [...envelopes.values()]
}

// how many evenly spaced points along a feature are mapped to the anchor
// genome for rainbow coloring; the mapped positions are averaged
const ANCHOR_SAMPLES = 5

// chain mapAnchor across levels until the coordinate is expressed in
// views[anchorLevel]'s coordinate system. startLevel is the view index the
// anchor coord starts in: view v is the bot side of display v-1 and the top
// side of display v. returns undefined if any hop has no covering alignment
export function mapToAnchor(
  levelIndexes: (LevelIndex | undefined)[],
  startLevel: number,
  anchor: Anchor,
  anchorLevel: number,
): Anchor | undefined {
  let current: Anchor | undefined = anchor
  let level = startLevel
  while (current && level > anchorLevel) {
    const index = levelIndexes[level - 1]
    current = index ? mapAnchor(index, 'bot', current) : undefined
    level--
  }
  while (current && level < anchorLevel) {
    const index = levelIndexes[level]
    current = index ? mapAnchor(index, 'top', current) : undefined
    level++
  }
  return current
}

// express a feature of the display at displayLevel in the anchor view's
// coordinate system, for rainbow coloring. samples ANCHOR_SAMPLES points
// along the feature interval on the anchor-near side (top side if the anchor
// is at or left of displayLevel, bot side otherwise), maps each to the
// anchor genome, and returns the majority anchor refName with the mean
// mapped coordinate — robust to a feature whose span crosses an alignment
// break. undefined when no sample maps
export function computeFeatureAnchorPos({
  levelIndexes,
  displayLevel,
  anchorLevel,
  topRef,
  topStart,
  topEnd,
  botRef,
  botStart,
  botEnd,
}: {
  levelIndexes: (LevelIndex | undefined)[]
  displayLevel: number
  anchorLevel: number
  topRef: string
  topStart: number
  topEnd: number
  botRef: string
  botStart: number
  botEnd: number
}): Anchor | undefined {
  const useTop = anchorLevel <= displayLevel
  const startLevel = useTop ? displayLevel : displayLevel + 1
  const refName = useTop ? topRef : botRef
  const start = useTop ? topStart : botStart
  const end = useTop ? topEnd : botEnd

  const mapped: Anchor[] = []
  for (let i = 0; i < ANCHOR_SAMPLES; i++) {
    const coord = start + ((i + 0.5) / ANCHOR_SAMPLES) * (end - start)
    const a = mapToAnchor(
      levelIndexes,
      startLevel,
      { refName, coord },
      anchorLevel,
    )
    if (a) {
      mapped.push(a)
    }
  }
  if (!mapped.length) {
    return undefined
  }

  const byRef = new Map<string, number[]>()
  for (const a of mapped) {
    const group = byRef.get(a.refName)
    if (group) {
      group.push(a.coord)
    } else {
      byRef.set(a.refName, [a.coord])
    }
  }
  const [majorityRef, coords] = [...byRef].sort(
    (a, b) => b[1].length - a[1].length,
  )[0]!
  return {
    refName: majorityRef,
    coord: coords.reduce((sum, c) => sum + c, 0) / coords.length,
  }
}
