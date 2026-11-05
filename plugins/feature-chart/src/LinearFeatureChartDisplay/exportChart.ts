/**
 * Exporting a maximized chart as PNG or SVG.
 *
 * Two very different backends, one file-naming/download story:
 *
 * - **Plotly (interactive)**: `Plotly.toImage()` produces a real PNG or a real
 *   SVG, because Plotly draws SVG+canvas internally. The layout size is set
 *   explicitly before the call (`relayout`) and `scale` is passed, because
 *   `toImage` otherwise reads the element's current size, which is affected by
 *   dialog layout — the classic "my exported figure is 300×150" bug.
 * - **Canvas (static)**: the canvas *is* the raster, so PNG is `toDataURL()`.
 *   SVG from a canvas is necessarily a wrapper around that raster (an SVG
 *   `<image>` pointing at the PNG data URL): it keeps the pixel dimensions and
 *   the theme background correct and opens everywhere, but it is not vector.
 *   The dialog says so in the UI; for vector output use the interactive tab.
 *
 * Filenames carry `trackId` + the chart's name, so a folder of exports from one
 * session is still traceable back to its track.
 */

import type { PlotlyExportHandle } from '../FeatureChartPlotlyRenderer/plotlyLoader.ts'

export type ChartExportFormat = 'png' | 'svg'

const MAX_FILE_PART_LENGTH = 60

/**
 * One path-safe component of a filename: letters, digits, `-`, `_`, `.` kept;
 * everything else (spaces, `/`, `:`, quotes, emoji) collapsed to `-`. Unicode
 * letters are preserved — a Chinese or Greek sample name is still readable in
 * the file manager.
 */
export function sanitizeFilePart(value: string, fallback: string): string {
  const cleaned = value
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}._-]+/gu, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
  return (cleaned || fallback).slice(0, MAX_FILE_PART_LENGTH)
}

/** `trackId-featureName.png`, e.g. `tissue_expression-Brain-TPM.box.svg`. */
export function chartExportFileName({
  trackId,
  featureName,
  format,
  suffix,
}: {
  trackId: string
  featureName: string
  format: ChartExportFormat
  /** Optional disambiguator, e.g. `plotly` vs `canvas`. */
  suffix?: string
}): string {
  const parts = [
    sanitizeFilePart(trackId, 'track'),
    sanitizeFilePart(featureName, 'chart'),
    ...(suffix ? [sanitizeFilePart(suffix, 'chart')] : []),
  ]
  return `${parts.join('-')}.${format}`
}

/** `canvas.toDataURL()` for a canvas that may have a 2D or webgl context. */
export function canvasPngDataUrl(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL('image/png')
}

/**
 * SVG document wrapping the canvas raster at its exact CSS size.
 *
 * `width`/`height` are the CSS pixels the dialog shows, not the backing-store
 * pixels, so the exported file is the size the user sees on a 2x display.
 */
export function canvasSvgDocument(
  pngDataUrl: string,
  { width, height }: { width: number; height: number },
): string {
  const w = Math.max(1, Math.round(width))
  const h = Math.max(1, Math.round(height))
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`,
    `<!-- raster fallback: this canvas chart has no vector form; use the interactive view for a true SVG -->`,
    `<image x="0" y="0" width="${w}" height="${h}" href="${pngDataUrl}" xlink:href="${pngDataUrl}" />`,
    `</svg>`,
  ].join('')
}

export function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

/**
 * Payload size of a data URL, in bytes. Used to prove an export is non-empty in
 * tests (`data-bytes` on the status element) without writing a file.
 */
export function dataUrlByteLength(dataUrl: string): number {
  const comma = dataUrl.indexOf(',')
  if (comma === -1) {
    return 0
  }
  const meta = dataUrl.slice(0, comma)
  const payload = dataUrl.slice(comma + 1)
  if (meta.includes(';base64')) {
    const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0
    return Math.max(0, Math.floor((payload.length * 3) / 4) - padding)
  }
  return decodeURIComponent(payload).length
}

/**
 * Trigger a browser download for a data URL. Pass `doc` in tests (jsdom).
 * Returns the byte length so callers can report it without decoding twice.
 */
export function downloadDataUrl(
  dataUrl: string,
  filename: string,
  doc: Document = document,
): number {
  const bytes = dataUrlByteLength(dataUrl)
  const anchor = doc.createElement('a')
  anchor.href = dataUrl
  anchor.download = filename
  anchor.rel = 'noopener'
  anchor.style.display = 'none'
  doc.body.append(anchor)
  anchor.click()
  anchor.remove()
  return bytes
}

/**
 * Export the interactive (Plotly) chart.
 *
 * The layout size is set explicitly and `scale` is passed because `toImage`
 * otherwise derives the image from the element's current box: inside a dialog
 * that box is affected by flex layout and the result can come out smaller than
 * the visible chart (the "export looked fine on screen" bug). `scale: 2` matches
 * the canvas path's device-pixel output, so both backends produce the same
 * pixel dimensions for the same dialog.
 */
export const PLOTLY_EXPORT_SCALE = 2

export async function plotlyExportDataUrl(
  { node, plotly }: PlotlyExportHandle,
  {
    format,
    width,
    height,
    scale = PLOTLY_EXPORT_SCALE,
  }: {
    format: ChartExportFormat
    width: number
    height: number
    scale?: number
  },
): Promise<string> {
  await plotly.relayout(node, { width, height })
  const result = await plotly.toImage(node, { format, width, height, scale })
  if (typeof result === 'string') {
    return result
  }
  // Plotly can return a Blob when a caller asks for one; normalise to a data URL
  // so one `downloadDataUrl()` handles both backends.
  return await blobToDataUrl(result as unknown as Blob)
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      resolve(String(reader.result))
    }
    reader.onerror = () => {
      reject(new Error('could not read the exported blob'))
    }
    reader.readAsDataURL(blob)
  })
}
