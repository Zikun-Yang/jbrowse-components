import { getSvgDimensions, setSvgViewport } from './svgToPng.ts'

const svg =
  '<svg width="1464" height="472" xmlns="http://www.w3.org/2000/svg" viewBox="0,0,1463.725,472"><rect width="1463.725" height="472" fill="#fff"/></svg>'

test('getSvgDimensions prefers fractional viewBox', () => {
  expect(getSvgDimensions(svg)).toEqual({
    vbX: 0,
    vbY: 0,
    width: 1463.725,
    height: 472,
  })
})

test('setSvgViewport ceils width/height attrs but keeps fractional viewBox', () => {
  const result = setSvgViewport(svg, 0, 0, 1463.725, 472)
  const tag = /<svg\s[^>]*>/.exec(result)![0]
  expect(tag).toContain('width="1464"')
  expect(tag).toContain('height="472"')
  expect(tag).toContain('viewBox="0 0 1463.725 472"')
  // Number.isInteger check used by the PNG encoder path
  const w = Number(/width="([^"]*)"/.exec(tag)![1])
  const h = Number(/height="([^"]*)"/.exec(tag)![1])
  expect(Number.isInteger(w)).toBe(true)
  expect(Number.isInteger(h)).toBe(true)
})

test('setSvgViewport ceils tile window attrs', () => {
  const result = setSvgViewport(svg, 0, 100.5, 1463.725, 200.25)
  const tag = /<svg\s[^>]*>/.exec(result)![0]
  expect(tag).toContain('width="1464"')
  expect(tag).toContain('height="201"')
  expect(tag).toContain('viewBox="0 100.5 1463.725 200.25"')
})

test('getSvgDimensions falls back to width/height attrs', () => {
  const noViewBox =
    '<svg width="800" height="600" xmlns="http://www.w3.org/2000/svg"></svg>'
  expect(getSvgDimensions(noViewBox)).toEqual({
    vbX: 0,
    vbY: 0,
    width: 800,
    height: 600,
  })
})

test('getSvgDimensions throws on missing dimensions', () => {
  expect(() =>
    getSvgDimensions('<svg xmlns="http://www.w3.org/2000/svg"></svg>'),
  ).toThrow('Could not determine SVG dimensions')
})
