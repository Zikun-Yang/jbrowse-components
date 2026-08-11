import { SimpleFeature } from '@jbrowse/core/util'

import {
  getIdentityColor,
  getRainbowColor,
} from '../../LinearSyntenyDisplay/drawSyntenyUtils.ts'
import {
  buildLevelIndex,
  computeFeatureAnchorPos,
  mapToAnchor,
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

test('getIdentityColor boundaries', () => {
  const themeHue = 160
  expect(getIdentityColor(undefined, themeHue)).toBe('#999999')
  // below the window clamps to the low end
  expect(getIdentityColor(0.5, themeHue)).toBe('hsl(160, 70%, 45%)')
  expect(getIdentityColor(0.85, themeHue)).toBe('hsl(160, 70%, 45%)')
  // midpoint of the window is a clean yellow
  expect(getIdentityColor(0.925, themeHue)).toBe('hsl(55, 70%, 45%)')
  // 100% identity is pure red
  expect(getIdentityColor(1, themeHue)).toBe('hsl(0, 70%, 45%)')
  // quarter point: halfway between theme hue and yellow
  expect(getIdentityColor(0.8875, themeHue)).toBe('hsl(107.5, 70%, 45%)')
})

test('getRainbowColor endpoints and clamping', () => {
  expect(getRainbowColor(0)).toBe('hsl(260, 75%, 50%)')
  expect(getRainbowColor(1)).toBe('hsl(0, 75%, 50%)')
  expect(getRainbowColor(0.5)).toBe('hsl(130, 75%, 50%)')
  expect(getRainbowColor(-1)).toBe('hsl(260, 75%, 50%)')
  expect(getRainbowColor(2)).toBe('hsl(0, 75%, 50%)')
})

test('mapToAnchor same level is identity', () => {
  const index = buildLevelIndex([makeFeature()], identity)
  expect(mapToAnchor([index], 0, { refName: 'ctgA', coord: 1234 }, 0)).toEqual({
    refName: 'ctgA',
    coord: 1234,
  })
})

test('mapToAnchor chains rightwards across levels', () => {
  // level 0: ctgA:1000-2000 <-> ctgB:5000-6000
  // level 1: ctgB:5200-5600 <-> ctgC:9000-9400
  const idx0 = buildLevelIndex([makeFeature()], identity)
  const idx1 = buildLevelIndex(
    [
      makeFeature({
        topRef: 'ctgB',
        topStart: 5200,
        topEnd: 5600,
        botRef: 'ctgC',
        botStart: 9000,
        botEnd: 9400,
      }),
    ],
    identity,
  )
  expect(
    mapToAnchor([idx0, idx1], 0, { refName: 'ctgA', coord: 1500 }, 2),
  ).toEqual({ refName: 'ctgC', coord: 9300 })
})

test('mapToAnchor chains leftwards across levels', () => {
  const idx0 = buildLevelIndex([makeFeature()], identity)
  const idx1 = buildLevelIndex(
    [
      makeFeature({
        topRef: 'ctgB',
        topStart: 5200,
        topEnd: 5600,
        botRef: 'ctgC',
        botStart: 9000,
        botEnd: 9400,
      }),
    ],
    identity,
  )
  expect(
    mapToAnchor([idx0, idx1], 2, { refName: 'ctgC', coord: 9300 }, 0),
  ).toEqual({ refName: 'ctgA', coord: 1500 })
})

test('mapToAnchor returns undefined when a hop has no coverage', () => {
  const idx0 = buildLevelIndex([makeFeature()], identity)
  const idx1 = buildLevelIndex(
    [
      makeFeature({
        topRef: 'ctgB',
        topStart: 5200,
        topEnd: 5600,
        botRef: 'ctgC',
        botStart: 9000,
        botEnd: 9400,
      }),
    ],
    identity,
  )
  // ctgA:1500 maps to ctgB:5500, fine; but starting outside coverage fails
  expect(
    mapToAnchor([idx0, idx1], 0, { refName: 'ctgA', coord: 99999 }, 2),
  ).toBeUndefined()
  // a missing intermediate index also fails
  expect(
    mapToAnchor([idx0, undefined], 0, { refName: 'ctgA', coord: 1500 }, 2),
  ).toBeUndefined()
})

test('computeFeatureAnchorPos direct top side when anchor is the top view', () => {
  const pos = computeFeatureAnchorPos({
    levelIndexes: [],
    displayLevel: 0,
    anchorLevel: 0,
    topRef: 'ctgA',
    topStart: 1000,
    topEnd: 2000,
    botRef: 'ctgB',
    botStart: 5000,
    botEnd: 6000,
  })
  expect(pos).toEqual({ refName: 'ctgA', coord: 1500 })
})

test('computeFeatureAnchorPos direct bot side when anchor is the bottom view', () => {
  const pos = computeFeatureAnchorPos({
    levelIndexes: [],
    displayLevel: 0,
    anchorLevel: 1,
    topRef: 'ctgA',
    topStart: 1000,
    topEnd: 2000,
    botRef: 'ctgB',
    botStart: 5000,
    botEnd: 6000,
  })
  expect(pos).toEqual({ refName: 'ctgB', coord: 5500 })
})

test('computeFeatureAnchorPos chains left to an earlier anchor', () => {
  // coloring a level-1 feature (ctgB:5200-5600 <-> ctgC:9000-9400) with
  // anchor view 0: samples along ctgB map through level 0's ctgA<->ctgB
  // feature (ctgA:1000-2000 <-> ctgB:5000-6000)
  const idx0 = buildLevelIndex([makeFeature()], identity)
  const pos = computeFeatureAnchorPos({
    levelIndexes: [idx0],
    displayLevel: 1,
    anchorLevel: 0,
    topRef: 'ctgB',
    topStart: 5200,
    topEnd: 5600,
    botRef: 'ctgC',
    botStart: 9000,
    botEnd: 9400,
  })
  // samples 5240,5320,5400,5480,5560 -> 1240,1320,1400,1480,1560 on ctgA
  expect(pos).toEqual({ refName: 'ctgA', coord: 1400 })
})

test('computeFeatureAnchorPos chains right, dropping unmappable samples', () => {
  // coloring the level-0 feature with anchor view 2: samples along ctgB
  // 5100..5900, but level 1 only covers ctgB:5200-5600
  const idx1 = buildLevelIndex(
    [
      makeFeature({
        topRef: 'ctgB',
        topStart: 5200,
        topEnd: 5600,
        botRef: 'ctgC',
        botStart: 9000,
        botEnd: 9400,
      }),
    ],
    identity,
  )
  const pos = computeFeatureAnchorPos({
    levelIndexes: [undefined, idx1],
    displayLevel: 0,
    anchorLevel: 2,
    topRef: 'ctgA',
    topStart: 1000,
    topEnd: 2000,
    botRef: 'ctgB',
    botStart: 5000,
    botEnd: 6000,
  })
  // 5300->9100 and 5500->9300 map; the rest fall outside coverage
  expect(pos).toEqual({ refName: 'ctgC', coord: 9200 })
})

test('computeFeatureAnchorPos picks the majority anchor chromosome', () => {
  // level 1 splits ctgB across two anchor chromosomes
  const idx1 = buildLevelIndex(
    [
      makeFeature({
        id: 'g1',
        topRef: 'ctgB',
        topStart: 5000,
        topEnd: 5500,
        botRef: 'ctgC',
        botStart: 9000,
        botEnd: 9500,
      }),
      makeFeature({
        id: 'g2',
        topRef: 'ctgB',
        topStart: 5500,
        topEnd: 6000,
        botRef: 'ctgD',
        botStart: 100,
        botEnd: 600,
      }),
    ],
    identity,
  )
  const pos = computeFeatureAnchorPos({
    levelIndexes: [undefined, idx1],
    displayLevel: 0,
    anchorLevel: 2,
    topRef: 'ctgA',
    topStart: 1000,
    topEnd: 2000,
    botRef: 'ctgB',
    botStart: 5000,
    botEnd: 6000,
  })
  // samples 5100,5300,5500 -> ctgC 9100,9300,9500; 5700,5900 -> ctgD 300,500
  expect(pos).toEqual({ refName: 'ctgC', coord: 9300 })
})

test('computeFeatureAnchorPos undefined when nothing maps', () => {
  const pos = computeFeatureAnchorPos({
    levelIndexes: [undefined],
    displayLevel: 0,
    anchorLevel: 2,
    topRef: 'ctgA',
    topStart: 1000,
    topEnd: 2000,
    botRef: 'ctgB',
    botStart: 5000,
    botEnd: 6000,
  })
  expect(pos).toBeUndefined()
})
