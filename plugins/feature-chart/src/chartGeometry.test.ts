import { SimpleFeature } from '@jbrowse/core/util'

import {
  computeChartIconLeft,
  computeChartRect,
  computeChartX,
  findFeatureAtChartX,
} from './chartGeometry.ts'

import type { ChartGeometry } from './chartGeometry.ts'
import type { Feature } from '@jbrowse/core/util'
import type { Region } from '@jbrowse/core/util/types'

const region: Region = {
  refName: 'ctgA',
  start: 1000,
  end: 21000,
  assemblyName: 'volvox',
}

const makeFeature = (start: number, end: number, name = 'gene') =>
  new SimpleFeature({ id: `f-${start}`, data: { start, end, name } }) as Feature

const geometry = (overrides: Partial<ChartGeometry> = {}): ChartGeometry => ({
  region,
  bpPerPx: 100 / 120, // 120px per feature of 100bp
  chartWidth: 120,
  align: 'left',
  ...overrides,
})

describe('computeChartX', () => {
  test('left align anchors the chart at the feature start', () => {
    const feature = makeFeature(6000, 6100)
    // (6000 - 1000) / (100/120) = 6000
    expect(computeChartX(feature, geometry())).toBeCloseTo(6000)
  })

  test('right align anchors the chart at the feature end', () => {
    const feature = makeFeature(6000, 6100)
    // end pixel 6120, minus the chart width
    expect(computeChartX(feature, geometry({ align: 'right' }))).toBeCloseTo(
      6000,
    )
  })

  test('center align centres the chart on the feature', () => {
    const feature = makeFeature(6000, 6100)
    // centre pixel 6060, minus half the chart width
    expect(computeChartX(feature, geometry({ align: 'center' }))).toBeCloseTo(
      6000,
    )
  })

  test('a chart is chartWidth wide whatever the feature bp span is', () => {
    const tiny = computeChartRect(makeFeature(6000, 6001), geometry())
    const huge = computeChartRect(makeFeature(6000, 20000), geometry())
    expect(tiny.width).toBe(120)
    expect(huge.width).toBe(120)
    expect(tiny.left).toBeCloseTo(huge.left)
  })
})

describe('findFeatureAtChartX', () => {
  const features = [makeFeature(1000, 1100), makeFeature(6000, 6100)]

  test('hits anywhere across the drawn chart, not only the bp span', () => {
    // the bp span of the second feature is 100bp = 120px here, so use a
    // zoomed-out geometry where the span is a couple of pixels
    const zoomedOut = geometry({ bpPerPx: 10 })
    const target = makeFeature(6000, 6100)
    const rect = computeChartRect(target, zoomedOut)
    // between the bp span and the chart's right edge: a bp-based test would
    // miss this point, the chart-based test must hit it
    const px = rect.right - 5
    expect(findFeatureAtChartX([target], zoomedOut, px)?.id()).toBe(target.id())
  })

  test('misses the gaps between charts', () => {
    const zoomedOut = geometry({ bpPerPx: 10 })
    const first = computeChartRect(features[0]!, zoomedOut)
    const second = computeChartRect(features[1]!, zoomedOut)
    const gap = (first.right + second.left) / 2
    expect(findFeatureAtChartX(features, zoomedOut, gap)).toBeUndefined()
  })

  test('overlapping charts resolve to the closest centre', () => {
    // feature a: chart [0,120] (centre 60), feature b: chart [12,132] (centre 72)
    const overlapping = [
      makeFeature(1000, 1100, 'a'),
      makeFeature(1010, 1110, 'b'),
    ]
    const centerAligned = geometry({ align: 'center' })
    expect(
      findFeatureAtChartX(overlapping, centerAligned, 100)?.get('name'),
    ).toBe('b')
    expect(
      findFeatureAtChartX(overlapping, centerAligned, 20)?.get('name'),
    ).toBe('a')
  })

  test('returns undefined for an empty feature list', () => {
    expect(findFeatureAtChartX([], geometry(), 10)).toBeUndefined()
  })
})

describe('computeChartIconLeft', () => {
  test('sits inside the chart top-right corner', () => {
    expect(
      computeChartIconLeft({
        chartLeft: 960,
        chartWidth: 120,
        iconSize: 20,
        displayWidth: 1600,
      }),
    ).toBe(1058)
  })

  test('clamps to the display when the chart is off the left edge', () => {
    expect(
      computeChartIconLeft({
        chartLeft: -100,
        chartWidth: 120,
        iconSize: 20,
        displayWidth: 1600,
      }),
    ).toBe(0)
  })

  test('clamps to the right edge of the display', () => {
    expect(
      computeChartIconLeft({
        chartLeft: 1590,
        chartWidth: 120,
        iconSize: 20,
        displayWidth: 1600,
      }),
    ).toBe(1578)
  })
})
