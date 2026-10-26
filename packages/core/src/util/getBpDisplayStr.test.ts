import { getBpDisplayStr } from './index.ts'

test('bp', () => {
  expect(getBpDisplayStr(0)).toBe('0bp')
  expect(getBpDisplayStr(500)).toBe('500bp')
  expect(getBpDisplayStr(999)).toBe('999bp')
})

test('kbp has a lowercase k', () => {
  expect(getBpDisplayStr(1000)).toBe('1kbp')
  expect(getBpDisplayStr(2000)).toBe('2kbp')
  expect(getBpDisplayStr(7720)).toBe('7.72kbp')
  expect(getBpDisplayStr(50_000)).toBe('50kbp')
  expect(getBpDisplayStr(999_999)).toBe('1,000kbp')
})

test('Mbp has an uppercase M', () => {
  expect(getBpDisplayStr(1_000_000)).toBe('1Mbp')
  expect(getBpDisplayStr(1_234_567)).toBe('1.23Mbp')
})
