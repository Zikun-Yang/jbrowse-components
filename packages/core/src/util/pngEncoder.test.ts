import { inflate } from 'pako-esm2'

import { createPngEncoder } from './pngEncoder.ts'

function concatParts(parts: Uint8Array[]) {
  const total = parts.reduce((acc, p) => acc + p.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const p of parts) {
    out.set(p, offset)
    offset += p.length
  }
  return out
}

function parseChunks(png: Uint8Array) {
  const chunks = [] as { type: string; data: Uint8Array; crc: number }[]
  let offset = 8 // skip signature
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength)
  while (offset < png.length) {
    const length = view.getUint32(offset)
    const type = String.fromCharCode(...png.subarray(offset + 4, offset + 8))
    chunks.push({
      type,
      data: png.subarray(offset + 8, offset + 8 + length),
      crc: view.getUint32(offset + 8 + length),
    })
    offset += 12 + length
  }
  return chunks
}

test('encodes a valid PNG', () => {
  const width = 2
  const height = 3
  const encoder = createPngEncoder({ width, height })
  // 6 pixels with distinct values
  const pixels = new Uint8Array([
    255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 10, 20, 30, 40, 50, 60, 70,
    80, 90, 100, 110, 120,
  ])
  // feed rows in two batches to exercise streaming
  encoder.addRows(pixels, 0, 1)
  encoder.addRows(pixels, 1, 2)
  const png = concatParts(encoder.finish())

  // signature
  expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10])

  const chunks = parseChunks(png)
  expect(chunks[0]!.type).toBe('IHDR')
  expect(chunks.at(-1)!.type).toBe('IEND')
  expect(chunks.at(-1)!.data.length).toBe(0)

  const ihdr = chunks[0]!.data
  const view = new DataView(ihdr.buffer, ihdr.byteOffset, ihdr.byteLength)
  expect(view.getUint32(0)).toBe(width)
  expect(view.getUint32(4)).toBe(height)
  expect(ihdr[8]).toBe(8) // bit depth
  expect(ihdr[9]).toBe(6) // RGBA
  expect(ihdr[10]).toBe(0) // compression
  expect(ihdr[11]).toBe(0) // filter
  expect(ihdr[12]).toBe(0) // interlace

  // decompress all IDAT chunks and verify scanlines (filter byte 0 + pixels)
  const idat = concatParts(
    chunks.filter(c => c.type === 'IDAT').map(c => c.data),
  )
  const raw = inflate(idat)
  const stride = width * 4
  expect(raw.length).toBe(height * (stride + 1))
  for (let r = 0; r < height; r++) {
    expect(raw[r * (stride + 1)]).toBe(0) // filter type: none
    expect([...raw.subarray(r * (stride + 1) + 1, (r + 1) * (stride + 1))])
      .toEqual([...pixels.subarray(r * stride, (r + 1) * stride)])
  }
})

test('crc32 of chunks is correct', () => {
  const encoder = createPngEncoder({ width: 1, height: 1 })
  encoder.addRows(new Uint8Array([1, 2, 3, 4]), 0, 1)
  const png = concatParts(encoder.finish())

  const crcTable = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    crcTable[n] = c
  }
  const crc32 = (buf: Uint8Array) => {
    let c = -1
    for (let i = 0; i < buf.length; i++) {
      c = crcTable[(c ^ buf[i]!) & 0xff]! ^ (c >>> 8)
    }
    return (c ^ -1) >>> 0
  }

  let offset = 8
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength)
  while (offset < png.length) {
    const length = view.getUint32(offset)
    const stored = view.getUint32(offset + 8 + length)
    const computed = crc32(png.subarray(offset + 4, offset + 8 + length))
    expect(computed).toBe(stored)
    offset += 12 + length
  }
})

test('throws on row count mismatch', () => {
  const encoder = createPngEncoder({ width: 1, height: 2 })
  encoder.addRows(new Uint8Array([1, 2, 3, 4]), 0, 1)
  expect(() => encoder.finish()).toThrow('row count mismatch')
})

test('rejects invalid dimensions', () => {
  expect(() => createPngEncoder({ width: 0, height: 10 })).toThrow()
  expect(() => createPngEncoder({ width: 10, height: -1 })).toThrow()
  expect(() => createPngEncoder({ width: 1.5, height: 10 })).toThrow()
})
