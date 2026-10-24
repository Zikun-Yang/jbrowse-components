import { Deflate } from 'pako-esm2'

// Pure-JS streaming PNG encoder. Browsers cap canvas dimensions (e.g. 65536px
// per side on some Chrome builds, 32767 or 16384 on other browsers/GPUs), so a
// very tall export cannot be encoded with canvas.toBlob in one shot. This
// encoder accepts rows incrementally (e.g. from tiles rasterized one at a
// time) and streams them through deflate, so the full-resolution bitmap never
// needs to exist in a single canvas.

const crcTable = new Int32Array(256)
for (let n = 0; n < 256; n++) {
  let c = n
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  }
  crcTable[n] = c
}

function crc32(buf: Uint8Array) {
  let c = -1
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]!) & 0xff]! ^ (c >>> 8)
  }
  return (c ^ -1) >>> 0
}

function makeChunk(type: string, data: Uint8Array) {
  const out = new Uint8Array(12 + data.length)
  const view = new DataView(out.buffer)
  view.setUint32(0, data.length)
  for (let i = 0; i < 4; i++) {
    out[4 + i] = type.charCodeAt(i)
  }
  out.set(data, 8)
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)))
  return out
}

const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])

/**
 * Create a streaming PNG encoder for an 8-bit RGBA image of the given
 * dimensions. Feed rows with addRows() (any number of rows at a time, in
 * order), then call finish() to get the PNG file as a list of byte chunks
 * (suitable for `new Blob(parts, { type: 'image/png' })`).
 */
export function createPngEncoder({
  width,
  height,
}: {
  width: number
  height: number
}) {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    width > 0x7fffffff ||
    height > 0x7fffffff
  ) {
    throw new Error(`Invalid PNG dimensions ${width}x${height}`)
  }

  const parts: Uint8Array[] = []
  const deflator = new Deflate()
  deflator.onData = (chunk: Uint8Array) => {
    parts.push(makeChunk('IDAT', chunk))
  }
  let rowsWritten = 0

  const ihdr = new Uint8Array(13)
  const view = new DataView(ihdr.buffer)
  view.setUint32(0, width)
  view.setUint32(4, height)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type: RGBA
  // compression (0), filter (0), interlace (0) remain 0
  parts.push(PNG_SIGNATURE, makeChunk('IHDR', ihdr))

  return {
    /**
     * Add `numRows` rows of raw RGBA pixels (starting at `startRow`) from a
     * buffer whose rows are `width * 4` bytes each. A filter-type byte (0) is
     * prepended to each scanline as required by the PNG format.
     */
    addRows(rgba: Uint8Array, startRow: number, numRows: number) {
      const stride = width * 4
      if (rgba.length < (startRow + numRows) * stride) {
        throw new Error('Not enough pixel data for requested rows')
      }
      const buf = new Uint8Array(numRows * (stride + 1))
      for (let r = 0; r < numRows; r++) {
        const srcOff = (startRow + r) * stride
        const dstOff = r * (stride + 1)
        // buf[dstOff] is already 0 (filter type: none)
        buf.set(rgba.subarray(srcOff, srcOff + stride), dstOff + 1)
      }
      deflator.push(buf, false)
      rowsWritten += numRows
    },
    finish() {
      if (rowsWritten !== height) {
        throw new Error(
          `PNG row count mismatch: expected ${height}, got ${rowsWritten}`,
        )
      }
      deflator.push(new Uint8Array(0), true)
      parts.push(makeChunk('IEND', new Uint8Array(0)))
      return parts
    },
  }
}
