import { SimpleFeature } from '@jbrowse/core/util'
import { Image, createCanvas } from 'canvas'

import { renderMultiRowXYPlot } from './renderMultiRowXYPlot.ts'

import type { Source } from '../util.ts'

// @ts-expect-error
global.nodeImage = Image
// @ts-expect-error
global.nodeCreateCanvas = createCanvas

function pixelAt(img: Image, x: number, y: number) {
  const canvas = createCanvas(img.width, img.height)
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0)
  return [...ctx.getImageData(x, y, 1, 1).data]
}

const rowHeight = 50

// two rows of 100px: row 0 has a negative score, row 1 a positive one
function makeProps(sources: Source[]) {
  return {
    regions: [{ refName: 'ctgA', start: 0, end: 100, assemblyName: 'volvox' }],
    scaleOpts: {
      domain: [-10, 10],
      range: [0, rowHeight],
      scaleType: 'linear' as const,
    },
    config: {
      color: '#f0f',
      posColor: '#292421',
      negColor: '#ff0000',
      bicolorPivotValue: 0,
      filled: true,
      minSize: 1,
      summaryScoreMode: 'max',
      clipColor: 'red',
    },
    sources,
    bpPerPx: 1,
    highResolutionScaling: 1,
    height: 2 * rowHeight,
    ticks: { values: [-10, 0, 10] },
    displayCrossHatches: false,
    inverted: false,
    offset: 5,
  }
}

const features = [
  new SimpleFeature({
    id: 'neg',
    data: { start: 10, end: 90, score: -10, source: 'neg' },
  }),
  new SimpleFeature({
    id: 'pos',
    data: { start: 10, end: 90, score: 10, source: 'pos' },
  }),
]

async function render(sources: Source[]) {
  const res = await renderMultiRowXYPlot(makeProps(sources) as any, features)
  return (res as any).value.imageData as Image
}

test('draws negative scores of a multi-row wiggle in the negative color', async () => {
  const img = await render([
    { name: 'neg', source: 'neg', color: '#292421', colorIsDefault: true },
    { name: 'pos', source: 'pos', color: '#292421', colorIsDefault: true },
  ])

  // every row is filled from the origin (score 0) to the score, so the
  // negative row fills downward and the positive row upward
  const [negR, negG, negB] = pixelAt(img, 50, 35)
  expect(negR).toBeGreaterThan(200)
  expect(negG).toBeLessThan(60)
  expect(negB).toBeLessThan(60)

  const [posR, posG, posB] = pixelAt(img, 50, 65)
  expect(posR).toBe(41)
  expect(posG).toBe(36)
  expect(posB).toBe(33)
})

test('keeps an explicit source color for a multi-row wiggle', async () => {
  // a subadapter color or a color the user picked is a choice, so both rows
  // are drawn in it instead of the bicolor default
  const img = await render([
    { name: 'neg', source: 'neg', color: '#00ff00' },
    { name: 'pos', source: 'pos', color: '#00ff00' },
  ])

  const [negR, negG, negB] = pixelAt(img, 50, 35)
  expect(negG).toBeGreaterThan(200)
  expect(negR).toBeLessThan(60)
  expect(negB).toBeLessThan(60)

  const [posR, posG, posB] = pixelAt(img, 50, 65)
  expect(posG).toBeGreaterThan(200)
  expect(posR).toBeLessThan(60)
  expect(posB).toBeLessThan(60)
})
