import { createPngEncoder } from './pngEncoder.ts'

// Conservative rasterization limits. Browsers cap canvas/SVG raster sizes
// differently (Chrome: 65536px per side and 16384^2 px area on some builds,
// Firefox/Safari/GPU-constrained builds can be lower, e.g. 32767 or 16384).
// Anything at or below these values works everywhere; larger exports are
// rasterized in vertical tiles and stitched into a single PNG with the
// pure-JS encoder in pngEncoder.ts.
const SAFE_DIMENSION = 16384
const SAFE_AREA = 16384 * 16384
const TILE_HEIGHT = 8192

interface SvgDimensions {
  vbX: number
  vbY: number
  width: number
  height: number
}

function getRootTag(html: string) {
  const match = /<svg\s[^>]*>/.exec(html)
  if (!match) {
    throw new Error('Invalid SVG: no root element found')
  }
  return match[0]
}

function getAttr(tag: string, name: string) {
  return new RegExp(`${name}="([^"]*)"`).exec(tag)?.[1]
}

/**
 * Determine the pixel dimensions an SVG should be rasterized at. Prefers the
 * viewBox over the width/height attributes: our generated SVGs use a viewBox
 * slightly wider than the width attribute, and rasterizing at the attribute
 * size makes the browser letterbox (squish + pad) the content.
 */
export function getSvgDimensions(html: string): SvgDimensions {
  const tag = getRootTag(html)
  const viewBox = getAttr(tag, 'viewBox')
    ?.split(/[ ,]+/)
    .map(Number)
  if (viewBox && viewBox.length === 4 && viewBox.every(Number.isFinite)) {
    const [vbX, vbY, width, height] = viewBox as [number, number, number, number]
    return { vbX, vbY, width, height }
  }
  const width = Number(getAttr(tag, 'width'))
  const height = Number(getAttr(tag, 'height'))
  if (Number.isFinite(width) && Number.isFinite(height) && width > 0) {
    return { vbX: 0, vbY: 0, width, height }
  }
  throw new Error('Could not determine SVG dimensions')
}

/**
 * Return the SVG with the root element's width/height/viewBox set to the
 * given window, so it rasterizes 1:1 at that size. Used to rasterize a
 * vertical slice of a large SVG without allocating a full-size canvas.
 */
export function setSvgViewport(
  html: string,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  // canvas dimensions must be integers; keep the fractional viewBox so the
  // content window stays exact and let the browser do the sub-pixel scaling
  const w = Math.ceil(width)
  const h = Math.ceil(height)
  return html.replace(/<svg\s[^>]*>/, tag => {
    let next = tag
    if (getAttr(next, 'width') !== undefined) {
      next = next.replace(/width="[^"]*"/, `width="${w}"`)
    }
    if (getAttr(next, 'height') !== undefined) {
      next = next.replace(/height="[^"]*"/, `height="${h}"`)
    }
    if (getAttr(next, 'viewBox') !== undefined) {
      next = next.replace(
        /viewBox="[^"]*"/,
        `viewBox="${x} ${y} ${width} ${height}"`,
      )
    } else {
      next = next.replace(/>$/, ` viewBox="${x} ${y} ${width} ${height}">`)
    }
    return next
  })
}

function loadSvgImage(html: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(new Blob([html], { type: 'image/svg+xml' }))
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load SVG for PNG conversion'))
    }
    img.src = url
  })
}

function drawToCanvas(img: HTMLImageElement, width: number, height: number) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  // browsers may silently clamp oversized canvas dimensions
  if (canvas.width !== width || canvas.height !== height) {
    return undefined
  }
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return undefined
  }
  ctx.drawImage(img, 0, 0)
  return { canvas, ctx }
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob | null>(resolve => {
    canvas.toBlob(blob => {
      resolve(blob)
    }, 'image/png')
  })
}

async function rasterizeTile(
  html: string,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const w = Math.ceil(width)
  const h = Math.ceil(height)
  const img = await loadSvgImage(setSvgViewport(html, x, y, width, height))
  const result = drawToCanvas(img, w, h)
  if (!result) {
    throw new Error(
      `Failed to allocate a ${w}x${h} canvas. Try exporting as SVG instead.`,
    )
  }
  const { canvas, ctx } = result
  const data = ctx.getImageData(0, 0, w, h)
  // release the canvas memory before the next tile
  canvas.width = 0
  canvas.height = 0
  return data.data
}

/**
 * Convert an SVG string to a PNG blob. Handles arbitrarily tall images: if
 * the direct canvas approach exceeds browser rasterization limits, the SVG is
 * rasterized in vertical tiles and stitched into a single full-resolution PNG
 * with a pure-JS encoder (no giant canvas required).
 */
export async function svgToPng(html: string): Promise<Blob> {
  const { vbX, vbY, width: vbWidth, height: vbHeight } = getSvgDimensions(html)
  // viewBox dimensions can be fractional (e.g. when the width includes a
  // measured track label length); canvases and the PNG encoder need integers
  const width = Math.ceil(vbWidth)
  const height = Math.ceil(vbHeight)
  const exceedsLimits =
    width > SAFE_DIMENSION ||
    height > SAFE_DIMENSION ||
    width * height > SAFE_AREA

  if (!exceedsLimits) {
    try {
      const img = await loadSvgImage(
        setSvgViewport(html, vbX, vbY, vbWidth, vbHeight),
      )
      const result = drawToCanvas(img, width, height)
      if (result) {
        const blob = await canvasToBlob(result.canvas)
        if (blob) {
          return blob
        }
      }
      // fall through to tiled encoding if the browser silently clamped the
      // canvas or failed to encode it
    } catch {
      // fall through to tiled encoding
    }
  }

  if (width > SAFE_DIMENSION) {
    throw new Error(
      `Image width (${width}px) exceeds this browser's limit. Try exporting as SVG instead.`,
    )
  }

  const encoder = createPngEncoder({ width, height })
  for (let y = 0; y < height; y += TILE_HEIGHT) {
    const tileHeight = Math.min(TILE_HEIGHT, height - y)
    const pixels = await rasterizeTile(html, vbX, vbY + y, vbWidth, tileHeight)
    encoder.addRows(pixels, 0, tileHeight)
  }
  return new Blob(encoder.finish(), { type: 'image/png' })
}
