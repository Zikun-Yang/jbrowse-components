import { getMultiRowColorCallback, getNiceDomain, getScale } from './util.ts'

test('linear scale', () => {
  const scaleType = 'linear'
  const domain = [0, 100]
  const range = [0, 100]
  const scale = getScale({ scaleType, domain, range })
  expect(scale.domain()).toEqual(domain)
})

test('log scale', () => {
  const scaleType = 'log'
  const domain = [1, 100]
  const range = [0, 100]
  const scale = getScale({ scaleType, domain, range })
  expect(scale.domain()).toEqual([1, 128])
})

test('test inverted', () => {
  const scaleType = 'log'
  const inverted = true
  const domain = [1, 100]
  const range = [0, 100]
  const scale = getScale({ scaleType, domain, range, inverted })
  expect(scale.domain()).toEqual([1, 128])
  expect(scale.range()).toEqual(range.reverse())
})

test('test minScore', () => {
  const scaleType = 'linear'
  const domain = [0, 100] as const
  const bounds = [50, undefined] as const
  const ret = getNiceDomain({ scaleType, domain, bounds })
  expect(ret).toEqual([50, 100])
})

test('test min and max score', () => {
  const scaleType = 'linear'
  const domain = [1, 100] as const
  const bounds = [undefined, 70] as const
  const ret = getNiceDomain({ scaleType, domain, bounds })
  expect(ret).toEqual([0, 70])
})

const bicolorConfig = {
  color: '#f0f',
  posColor: '#292421',
  negColor: '#ff0000',
  bicolorPivotValue: 0,
}

test('multi-row default color uses the bicolor pos/neg callback', () => {
  const cb = getMultiRowColorCallback(
    { name: 'k', source: 'k', color: '#292421', colorIsDefault: true },
    bicolorConfig as any,
  )
  expect(cb({} as any, -1)).toBe('#ff0000')
  expect(cb({} as any, 1)).toBe('#292421')
  // the pivot defaults to 0 even though readConfObject reports a 0 slot of a
  // plain config object as undefined
  expect(cb({} as any, 0)).toBe('#292421')
})

test('multi-row explicit source color wins over the bicolor callback', () => {
  const cb = getMultiRowColorCallback(
    { name: 'k', source: 'k', color: '#00ff00' },
    bicolorConfig as any,
  )
  expect(cb({} as any, -1)).toBe('#00ff00')
  expect(cb({} as any, 1)).toBe('#00ff00')
})
