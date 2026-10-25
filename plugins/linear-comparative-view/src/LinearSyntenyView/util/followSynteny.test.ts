import { SimpleFeature } from '@jbrowse/core/util'

import {
  buildLevelIndex,
  computeFollowTargets,
  filterTopCumulative,
  findMatePosInCigar,
  findPosInCigar,
  mapAnchor,
  mapWindow,
  mapWindowWeighted,
} from './followSynteny.ts'

import type { Canonicalize } from './followSynteny.ts'

const identity: Canonicalize = (asm, ref) => ref

function makeFeature({
  id = 'f1',
  topRef = 'ctgA',
  topStart = 1000,
  topEnd = 2000,
  botRef = 'ctgB',
  botStart = 5000,
  botEnd = 6000,
  strand = 1,
  cigar,
}: {
  id?: string
  topRef?: string
  topStart?: number
  topEnd?: number
  botRef?: string
  botStart?: number
  botEnd?: number
  strand?: number
  cigar?: string
} = {}) {
  return new SimpleFeature({
    uniqueId: id,
    refName: topRef,
    start: topStart,
    end: topEnd,
    assemblyName: 'asm1',
    strand,
    ...(cigar ? { CIGAR: cigar } : {}),
    mate: {
      start: botStart,
      end: botEnd,
      refName: botRef,
      assemblyName: 'asm2',
    },
  })
}

test('findPosInCigar basic', () => {
  // 400M then 100D: offset 500 on feat axis lands inside the D, mate stays 400
  expect(findPosInCigar(['400', 'M', '100', 'D', '600', 'M'], 500)).toEqual([
    500, 400,
  ])
  // 400M then 100I: offset 500 on feat axis, insertion counts towards mate
  expect(findPosInCigar(['400', 'M', '100', 'I', '600', 'M'], 500)).toEqual([
    500, 600,
  ])
})

test('findMatePosInCigar basic', () => {
  // reverse of the I case above: offset 600 on mate axis -> 500 on feat axis
  expect(findMatePosInCigar(['400', 'M', '100', 'I', '600', 'M'], 600)).toEqual(
    [600, 500],
  )
  // offset 400 on mate axis stops at the start of the D (round-trip through
  // a deletion collapses to the start of the deletion)
  expect(findMatePosInCigar(['400', 'M', '100', 'D', '600', 'M'], 400)).toEqual(
    [400, 400],
  )
})

test('mapAnchor linear interpolation, forward strand', () => {
  const index = buildLevelIndex([makeFeature()], identity)
  expect(mapAnchor(index, 'top', { refName: 'ctgA', coord: 1500 })).toEqual({
    refName: 'ctgB',
    coord: 5500,
  })
})

test('mapAnchor inversion mirrors coordinates (A -> reversed B)', () => {
  const index = buildLevelIndex([makeFeature({ strand: -1 })], identity)
  // top start maps to mate end and vice versa
  expect(mapAnchor(index, 'top', { refName: 'ctgA', coord: 1000 })).toEqual({
    refName: 'ctgB',
    coord: 6000,
  })
  expect(mapAnchor(index, 'top', { refName: 'ctgA', coord: 2000 })).toEqual({
    refName: 'ctgB',
    coord: 5000,
  })
  expect(mapAnchor(index, 'top', { refName: 'ctgA', coord: 1500 })).toEqual({
    refName: 'ctgB',
    coord: 5500,
  })
})

test('mapAnchor inversion, bottom to top', () => {
  const index = buildLevelIndex([makeFeature({ strand: -1 })], identity)
  expect(mapAnchor(index, 'bot', { refName: 'ctgB', coord: 5500 })).toEqual({
    refName: 'ctgA',
    coord: 1500,
  })
})

test('mapAnchor with CIGAR deletion', () => {
  // feat axis consumes 400M+100D+600M = 1100, mate axis consumes 1000
  const index = buildLevelIndex(
    [makeFeature({ topEnd: 2100, cigar: '400M100D600M' })],
    identity,
  )
  // offset 500 on top: 400 match + 100 into deletion -> 400 on mate
  expect(mapAnchor(index, 'top', { refName: 'ctgA', coord: 1500 })).toEqual({
    refName: 'ctgB',
    coord: 5400,
  })
})

test('mapAnchor with CIGAR insertion', () => {
  // feat axis consumes 1000, mate axis consumes 400M+100I+600M = 1100
  const index = buildLevelIndex(
    [makeFeature({ botEnd: 6100, cigar: '400M100I600M' })],
    identity,
  )
  expect(mapAnchor(index, 'top', { refName: 'ctgA', coord: 1500 })).toEqual({
    refName: 'ctgB',
    coord: 5600,
  })
})

test('mapAnchor bottom to top with CIGAR round-trips', () => {
  const index = buildLevelIndex(
    [makeFeature({ botEnd: 6100, cigar: '400M100I600M' })],
    identity,
  )
  expect(mapAnchor(index, 'bot', { refName: 'ctgB', coord: 5600 })).toEqual({
    refName: 'ctgA',
    coord: 1500,
  })
})

test('mapAnchor inversion with CIGAR', () => {
  const index = buildLevelIndex(
    [makeFeature({ topEnd: 2100, strand: -1, cigar: '400M100D600M' })],
    identity,
  )
  // offset 500 on top -> 400 along mate axis from mateEnd
  expect(mapAnchor(index, 'top', { refName: 'ctgA', coord: 1500 })).toEqual({
    refName: 'ctgB',
    coord: 5600,
  })
})

test('mapAnchor returns undefined without coverage', () => {
  const index = buildLevelIndex([makeFeature()], identity)
  expect(
    mapAnchor(index, 'top', { refName: 'ctgA', coord: 500 }),
  ).toBeUndefined()
  expect(
    mapAnchor(index, 'top', { refName: 'ctgZ', coord: 1500 }),
  ).toBeUndefined()
})

test('mapAnchor prefers feature with max viewport overlap', () => {
  const index = buildLevelIndex(
    [
      makeFeature({ id: 'short', botRef: 'ctgX' }),
      makeFeature({ id: 'long', topStart: 0, topEnd: 3000, botRef: 'ctgY' }),
    ],
    identity,
  )
  // both cover coord 1500; viewport fully inside the short feature
  expect(
    mapAnchor(
      index,
      'top',
      { refName: 'ctgA', coord: 1500 },
      { start: 1200, end: 1800 },
    ),
  ).toMatchObject({ refName: 'ctgX' })
  // viewport mostly outside the short feature -> long one wins
  expect(
    mapAnchor(
      index,
      'top',
      { refName: 'ctgA', coord: 1500 },
      { start: 1900, end: 2900 },
    ),
  ).toMatchObject({ refName: 'ctgY' })
})

test('buildLevelIndex canonicalizes refNames', () => {
  const canonicalize: Canonicalize = (asm, ref) =>
    asm === 'asm1' && ref === 'chrA' ? 'ctgA' : ref
  const index = buildLevelIndex([makeFeature({ topRef: 'chrA' })], canonicalize)
  expect(
    mapAnchor(index, 'top', { refName: 'ctgA', coord: 1500 }),
  ).toMatchObject({ refName: 'ctgB', coord: 5500 })
  expect(
    mapAnchor(index, 'top', { refName: 'chrA', coord: 1500 }),
  ).toBeUndefined()
})

test('buildLevelIndex caches by features array reference', () => {
  const features = [makeFeature()]
  expect(buildLevelIndex(features, identity)).toBe(
    buildLevelIndex(features, identity),
  )
})

test('mapWindow lifts a whole region, forward strand', () => {
  const index = buildLevelIndex([makeFeature()], identity)
  expect(
    mapWindow(index, 'top', { refName: 'ctgA', start: 1200, end: 1400 }),
  ).toEqual([{ refName: 'ctgB', start: 5200, end: 5400 }])
})

test('mapWindow inversion swaps and normalizes edges', () => {
  const index = buildLevelIndex([makeFeature({ strand: -1 })], identity)
  expect(
    mapWindow(index, 'top', { refName: 'ctgA', start: 1200, end: 1400 }),
  ).toEqual([{ refName: 'ctgB', start: 5600, end: 5800 }])
})

test('mapWindow maps only the overlapping part of a feature', () => {
  const index = buildLevelIndex([makeFeature()], identity)
  // window 500-1500 overlaps the feature (1000-2000) over 1000-1500; only
  // that sub-interval is mapped, at exact base precision
  expect(
    mapWindow(index, 'top', { refName: 'ctgA', start: 500, end: 1500 }),
  ).toEqual([{ refName: 'ctgB', start: 5000, end: 5500 }])
})

test('mapWindow maps a sub-window at exact base precision', () => {
  // feature ctgA:0-10 -> ctgB:5-15, displayed window 3-7 -> mapped 8-12,
  // not the full 5-15
  const index = buildLevelIndex(
    [makeFeature({ topStart: 0, topEnd: 10, botStart: 5, botEnd: 15 })],
    identity,
  )
  expect(
    mapWindow(index, 'top', { refName: 'ctgA', start: 3, end: 7 }),
  ).toEqual([{ refName: 'ctgB', start: 8, end: 12 }])
})

test('mapWindow with CIGAR maps edges through the CIGAR walk', () => {
  // feat axis consumes 400M+100D+600M = 1100, mate axis consumes 1000
  const index = buildLevelIndex(
    [makeFeature({ topEnd: 2100, cigar: '400M100D600M' })],
    identity,
  )
  // overlap 0-500 on the feat axis: 500 lands inside the deletion -> 400 on
  // the mate axis
  expect(
    mapWindow(index, 'top', { refName: 'ctgA', start: 1000, end: 1500 }),
  ).toEqual([{ refName: 'ctgB', start: 5000, end: 5400 }])
})

test('mapWindow with window covering the whole CIGAR feature', () => {
  const index = buildLevelIndex(
    [makeFeature({ topEnd: 2100, cigar: '400M100D600M' })],
    identity,
  )
  expect(
    mapWindow(index, 'top', { refName: 'ctgA', start: 1000, end: 2100 }),
  ).toEqual([{ refName: 'ctgB', start: 5000, end: 6000 }])
})

test('mapWindow returns empty without coverage', () => {
  const index = buildLevelIndex([makeFeature()], identity)
  expect(
    mapWindow(index, 'top', { refName: 'ctgA', start: 0, end: 500 }),
  ).toEqual([])
})

test('mapWindow works when the window center is in a gap but an edge is covered', () => {
  const index = buildLevelIndex([makeFeature()], identity)
  // center 2250 is outside the feature (1000-2000) but the left edge
  // overlaps 1500-2000
  expect(
    mapWindow(index, 'top', { refName: 'ctgA', start: 1500, end: 3000 }),
  ).toEqual([{ refName: 'ctgB', start: 5500, end: 6000 }])
})

test('mapWindow merges multiple blocks on the same target chromosome into an envelope', () => {
  const index = buildLevelIndex(
    [
      makeFeature({ id: 'b1' }),
      makeFeature({
        id: 'b2',
        topStart: 4000,
        topEnd: 6000,
        botStart: 8000,
        botEnd: 10000,
      }),
    ],
    identity,
  )
  // whole-chromosome window spanning both blocks
  expect(
    mapWindow(index, 'top', { refName: 'ctgA', start: 0, end: 10000 }),
  ).toEqual([{ refName: 'ctgB', start: 5000, end: 10000 }])
})

test('mapWindow returns one window per target chromosome', () => {
  // like human chr2 being syntenic to two separate chromosomes chr2a/chr2b
  const index = buildLevelIndex(
    [
      makeFeature({ id: 'b1' }),
      makeFeature({
        id: 'b2',
        topStart: 4000,
        topEnd: 6000,
        botRef: 'ctgC',
        botStart: 100,
        botEnd: 2100,
      }),
    ],
    identity,
  )
  expect(
    mapWindow(index, 'top', { refName: 'ctgA', start: 0, end: 10000 }),
  ).toEqual([
    { refName: 'ctgB', start: 5000, end: 6000 },
    { refName: 'ctgC', start: 100, end: 2100 },
  ])
})

test('mapWindow merges forward and inversion blocks on the same chromosome', () => {
  const index = buildLevelIndex(
    [
      makeFeature({ id: 'fwd' }),
      makeFeature({
        id: 'inv',
        topStart: 3000,
        topEnd: 4000,
        botStart: 7000,
        botEnd: 8000,
        strand: -1,
      }),
    ],
    identity,
  )
  expect(
    mapWindow(index, 'top', { refName: 'ctgA', start: 0, end: 5000 }),
  ).toEqual([{ refName: 'ctgB', start: 5000, end: 8000 }])
})

test('computeFollowTargets propagates right through levels', () => {
  // level 0: view0 ctgA:0-10000 <-> view1 ctgB:0-20000 (2x scale)
  const level0 = buildLevelIndex(
    [
      makeFeature({
        topStart: 0,
        topEnd: 10000,
        botStart: 0,
        botEnd: 20000,
      }),
    ],
    identity,
  )
  // level 1: view1 ctgB:0-20000 <-> view2 ctgC:5000-15000
  const level1 = buildLevelIndex(
    [
      makeFeature({
        topRef: 'ctgB',
        topStart: 0,
        topEnd: 20000,
        botRef: 'ctgC',
        botStart: 5000,
        botEnd: 15000,
      }),
    ],
    identity,
  )
  const targets = computeFollowTargets({
    sourceIndex: 0,
    source: { refName: 'ctgA', start: 4000, end: 6000 },
    levelIndexes: [{ fwd: level0 }, { fwd: level1 }],
  })
  expect(targets.get(1)).toEqual([{ refName: 'ctgB', start: 8000, end: 12000 }])
  expect(targets.get(2)).toEqual([{ refName: 'ctgC', start: 9000, end: 11000 }])
})

test('computeFollowTargets propagates left', () => {
  const level0 = buildLevelIndex(
    [makeFeature({ topStart: 0, topEnd: 10000, botStart: 0, botEnd: 20000 })],
    identity,
  )
  const level1 = buildLevelIndex(
    [
      makeFeature({
        topRef: 'ctgB',
        topStart: 0,
        topEnd: 20000,
        botRef: 'ctgC',
        botStart: 5000,
        botEnd: 15000,
      }),
    ],
    identity,
  )
  const targets = computeFollowTargets({
    sourceIndex: 2,
    source: { refName: 'ctgC', start: 9000, end: 11000 },
    levelIndexes: [{ fwd: level0 }, { fwd: level1 }],
  })
  expect(targets.get(1)).toEqual([{ refName: 'ctgB', start: 8000, end: 12000 }])
  expect(targets.get(0)).toEqual([{ refName: 'ctgA', start: 4000, end: 6000 }])
})

test('computeFollowTargets propagates left through the reverse index', () => {
  // rev index orientation: top = views[level + 1] coords, bot = views[level]
  // coords — i.e. feature refName is the bottom view's, mate is the top view's
  const level0rev = buildLevelIndex(
    [
      makeFeature({
        topRef: 'ctgB',
        topStart: 0,
        topEnd: 20000,
        botRef: 'ctgA',
        botStart: 0,
        botEnd: 10000,
      }),
    ],
    identity,
  )
  const targets = computeFollowTargets({
    sourceIndex: 1,
    source: { refName: 'ctgB', start: 8000, end: 12000 },
    levelIndexes: [{ rev: level0rev }],
  })
  expect(targets.get(0)).toEqual([{ refName: 'ctgA', start: 4000, end: 6000 }])
})

test('computeFollowTargets propagates right through the reverse index as fallback', () => {
  // only rev coverage available: its bot side is keyed by views[level] refs,
  // so right propagation still works
  const level0rev = buildLevelIndex(
    [
      makeFeature({
        topRef: 'ctgB',
        topStart: 0,
        topEnd: 20000,
        botRef: 'ctgA',
        botStart: 0,
        botEnd: 10000,
      }),
    ],
    identity,
  )
  const targets = computeFollowTargets({
    sourceIndex: 0,
    source: { refName: 'ctgA', start: 4000, end: 6000 },
    levelIndexes: [{ rev: level0rev }],
  })
  expect(targets.get(1)).toEqual([{ refName: 'ctgB', start: 8000, end: 12000 }])
})

test('computeFollowTargets uses rev coverage when fwd exists but does not cover the window', () => {
  // fwd has data, but only over a stale position (mid-cascade); the rev index
  // covers the source window and must still be consulted
  const level0fwd = buildLevelIndex(
    [
      makeFeature({
        topStart: 50000,
        topEnd: 60000,
        botStart: 50000,
        botEnd: 60000,
      }),
    ],
    identity,
  )
  const level0rev = buildLevelIndex(
    [
      makeFeature({
        topRef: 'ctgB',
        topStart: 0,
        topEnd: 20000,
        botRef: 'ctgA',
        botStart: 0,
        botEnd: 10000,
      }),
    ],
    identity,
  )
  const targets = computeFollowTargets({
    sourceIndex: 0,
    source: { refName: 'ctgA', start: 4000, end: 6000 },
    levelIndexes: [{ fwd: level0fwd, rev: level0rev }],
  })
  expect(targets.get(1)).toEqual([{ refName: 'ctgB', start: 8000, end: 12000 }])
})

test('computeFollowTargets uses fwd coverage when rev exists but does not cover the window', () => {
  // leftward mirror of the above: rev has data over a stale position, fwd's
  // bot side covers the source window
  const level0fwd = buildLevelIndex(
    [
      makeFeature({
        topRef: 'ctgA',
        topStart: 0,
        topEnd: 10000,
        botRef: 'ctgB',
        botStart: 0,
        botEnd: 20000,
      }),
    ],
    identity,
  )
  const level0rev = buildLevelIndex(
    [
      makeFeature({
        topRef: 'ctgB',
        topStart: 50000,
        topEnd: 60000,
        botRef: 'ctgA',
        botStart: 50000,
        botEnd: 60000,
      }),
    ],
    identity,
  )
  const targets = computeFollowTargets({
    sourceIndex: 1,
    source: { refName: 'ctgB', start: 8000, end: 12000 },
    levelIndexes: [{ fwd: level0fwd, rev: level0rev }],
  })
  expect(targets.get(0)).toEqual([{ refName: 'ctgA', start: 4000, end: 6000 }])
})

test('computeFollowTargets stops at gap in coverage', () => {
  const level0 = buildLevelIndex([makeFeature()], identity)
  const level1 = buildLevelIndex(
    [
      makeFeature({
        topRef: 'ctgB',
        topStart: 0,
        topEnd: 100,
        botRef: 'ctgC',
        botStart: 0,
        botEnd: 100,
      }),
    ],
    identity,
  )
  // maps to ctgB:5400-5600 at level 0, but level 1 only covers ctgB:0-100
  const targets = computeFollowTargets({
    sourceIndex: 0,
    source: { refName: 'ctgA', start: 1400, end: 1600 },
    levelIndexes: [{ fwd: level0 }, { fwd: level1 }],
  })
  expect(targets.get(1)).toEqual([{ refName: 'ctgB', start: 5400, end: 5600 }])
  expect(targets.has(2)).toBe(false)
})

test('computeFollowTargets propagates multi-chromosome envelopes through levels', () => {
  // level 0: view0 ctgA:0-10000 -> view1 ctgB:0-10000 and ctgC:0-10000
  const level0 = buildLevelIndex(
    [
      makeFeature({
        id: 'b1',
        topStart: 0,
        topEnd: 10000,
        botStart: 0,
        botEnd: 10000,
      }),
      makeFeature({
        id: 'b2',
        topStart: 0,
        topEnd: 10000,
        botRef: 'ctgC',
        botStart: 0,
        botEnd: 10000,
      }),
    ],
    identity,
  )
  // level 1: both ctgB and ctgC of view1 map into view2 ctgD
  const level1 = buildLevelIndex(
    [
      makeFeature({
        id: 'c1',
        topRef: 'ctgB',
        topStart: 2000,
        topEnd: 4000,
        botRef: 'ctgD',
        botStart: 0,
        botEnd: 2000,
      }),
      makeFeature({
        id: 'c2',
        topRef: 'ctgC',
        topStart: 6000,
        topEnd: 8000,
        botRef: 'ctgD',
        botStart: 5000,
        botEnd: 7000,
      }),
    ],
    identity,
  )
  const targets = computeFollowTargets({
    sourceIndex: 0,
    source: { refName: 'ctgA', start: 2500, end: 7500 },
    levelIndexes: [{ fwd: level0 }, { fwd: level1 }],
  })
  expect(targets.get(1)).toEqual([
    { refName: 'ctgB', start: 2500, end: 7500 },
    { refName: 'ctgC', start: 2500, end: 7500 },
  ])
  // ctgB:2500-7500 hits c1 (2000-4000) -> ctgD:500-2000; ctgC:2500-7500 hits
  // c2 (6000-8000) -> ctgD:5000-6500; merged into one ctgD envelope
  expect(targets.get(2)).toEqual([{ refName: 'ctgD', start: 500, end: 6500 }])
})

test('mapWindowWeighted weight is the source-side overlap, not the envelope span', () => {
  // two distant blocks on ctgB: the envelope spans ctgB:0-1000 but the
  // actual aligned overlap is only 100 + 100 = 200
  const index = buildLevelIndex(
    [
      makeFeature({
        id: 'a1',
        topStart: 0,
        topEnd: 100,
        botStart: 0,
        botEnd: 100,
      }),
      makeFeature({
        id: 'a2',
        topStart: 900,
        topEnd: 1000,
        botStart: 900,
        botEnd: 1000,
      }),
    ],
    identity,
  )
  expect(
    mapWindowWeighted(index, 'top', { refName: 'ctgA', start: 0, end: 1000 }),
  ).toEqual([{ refName: 'ctgB', start: 0, end: 1000, weight: 200 }])
})

test('mapWindowWeighted sums weights across blocks on the same chromosome', () => {
  const index = buildLevelIndex(
    [
      makeFeature({ id: 'b1' }),
      makeFeature({
        id: 'b2',
        topStart: 4000,
        topEnd: 6000,
        botStart: 8000,
        botEnd: 10000,
      }),
      makeFeature({
        id: 'b3',
        topStart: 0,
        topEnd: 500,
        botRef: 'ctgC',
        botStart: 0,
        botEnd: 500,
      }),
    ],
    identity,
  )
  expect(
    mapWindowWeighted(index, 'top', { refName: 'ctgA', start: 0, end: 10000 }),
  ).toEqual([
    { refName: 'ctgC', start: 0, end: 500, weight: 500 },
    { refName: 'ctgB', start: 5000, end: 10000, weight: 3000 },
  ])
})

test('filterTopCumulative keeps top-weight chromosomes until the threshold', () => {
  const windows = [
    { refName: 'ctgB', start: 0, end: 100, weight: 800 },
    { refName: 'ctgC', start: 0, end: 100, weight: 150 },
    { refName: 'ctgD', start: 0, end: 100, weight: 50 },
  ]
  // total 1000; 80% -> ctgB alone (800 >= 800)
  expect(filterTopCumulative(windows, 80)).toEqual([windows[0]])
  // 90% -> ctgB + ctgC (800 + 150 = 950 >= 900)
  expect(filterTopCumulative(windows, 90)).toEqual([windows[0], windows[1]])
  // 100% -> everything, and pct >= 100 is a pass-through
  expect(filterTopCumulative(windows, 100)).toEqual(windows)
})

test('filterTopCumulative always keeps the largest chromosome', () => {
  const windows = [
    { refName: 'ctgB', start: 0, end: 100, weight: 100 },
    { refName: 'ctgC', start: 0, end: 100, weight: 900 },
  ]
  // even at 1% the largest (ctgC) is kept, and the input order is preserved
  expect(filterTopCumulative(windows, 1)).toEqual([windows[1]])
  expect(filterTopCumulative(windows, 50)).toEqual([windows[1]])
})

test('filterTopCumulative ignores the envelope span when ranking', () => {
  // ctgB has a huge envelope but little aligned overlap (the a1 --- a2
  // case); ctgC is small but fully overlapped, so ctgC wins
  const windows = [
    { refName: 'ctgB', start: 0, end: 100000, weight: 200 },
    { refName: 'ctgC', start: 0, end: 800, weight: 800 },
  ]
  expect(filterTopCumulative(windows, 50)).toEqual([windows[1]])
})

test('computeFollowTargets filters minor chromosomes by maxCumulativePct', () => {
  // level 0: ctgA maps mostly to ctgB (weight 900) with a small
  // repeat-induced hit on ctgC (weight 100)
  const level0 = buildLevelIndex(
    [
      makeFeature({
        id: 'main',
        topStart: 0,
        topEnd: 900,
        botStart: 0,
        botEnd: 900,
      }),
      makeFeature({
        id: 'repeat',
        topStart: 900,
        topEnd: 1000,
        botRef: 'ctgC',
        botStart: 0,
        botEnd: 100,
      }),
    ],
    identity,
  )
  const all = computeFollowTargets({
    sourceIndex: 0,
    source: { refName: 'ctgA', start: 0, end: 1000 },
    levelIndexes: [{ fwd: level0 }],
  })
  expect(all.get(1)).toEqual([
    { refName: 'ctgB', start: 0, end: 900 },
    { refName: 'ctgC', start: 0, end: 100 },
  ])
  const filtered = computeFollowTargets({
    sourceIndex: 0,
    source: { refName: 'ctgA', start: 0, end: 1000 },
    levelIndexes: [{ fwd: level0 }],
    maxCumulativePct: 80,
  })
  expect(filtered.get(1)).toEqual([{ refName: 'ctgB', start: 0, end: 900 }])
})
