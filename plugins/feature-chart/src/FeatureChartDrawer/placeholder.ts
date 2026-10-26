import type { FeatureChartColorScheme } from './colorSchemes.ts'

/**
 * Canvas placeholders for the two ways a chart can fail to draw: an unknown
 * drawer name and an invalid chart spec.
 *
 * Both are drawn instead of throwing. In the RPC worker a throw is not caught
 * per chart — it marks the whole track as errored, which is exactly what a user
 * cannot debug.
 */

/** Break `text` into lines that fit `maxWidth`, at most 5 lines. */
export function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (current && ctx.measureText(candidate).width > maxWidth) {
      lines.push(current)
      current = word
    } else {
      current = candidate
    }
  }
  if (current) {
    lines.push(current)
  }

  const maxLines = 5
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines)
    kept[maxLines - 1] =
      `${kept[maxLines - 1]!.slice(0, Math.max(0, kept[maxLines - 1]!.length - 1))}…`
    return kept
  }
  return lines
}

export interface PlaceholderContent {
  /** Bold first line: what went wrong. */
  title: string
  /** Muted lines: why, what to do, what was available. */
  body: string[]
}

/**
 * Framed panel with a title and wrapped body lines, centered.
 * Kept deliberately simple: `Error`-free, no throwing, worker-canvas safe.
 */
export function drawPlaceholderPanel(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  content: PlaceholderContent,
  colorScheme: FeatureChartColorScheme,
) {
  ctx.fillStyle = colorScheme.background
  ctx.fillRect(0, 0, width, height)

  ctx.strokeStyle = '#f9a825'
  ctx.lineWidth = 1
  ctx.strokeRect(0.5, 0.5, Math.max(0, width - 1), Math.max(0, height - 1))

  ctx.fillStyle = colorScheme.text
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  const titleFont = `600 ${Math.max(9, Math.min(13, height * 0.07))}px sans-serif`
  const bodyFont = `${Math.max(8, Math.min(11, height * 0.055))}px sans-serif`

  ctx.font = titleFont
  const titleLines = wrapText(ctx, content.title, width - 16)
  ctx.font = bodyFont
  const bodyLines = content.body.flatMap(line => wrapText(ctx, line, width - 16))

  const titleLineHeight = Math.max(11, Math.min(16, height * 0.085))
  const bodyLineHeight = Math.max(10, Math.min(14, height * 0.07))
  const totalHeight =
    titleLines.length * titleLineHeight + bodyLines.length * bodyLineHeight
  let y = Math.max(4, (height - totalHeight) / 2) + titleLineHeight / 2

  ctx.font = titleFont
  for (const line of titleLines) {
    ctx.fillText(line, width / 2, y)
    y += titleLineHeight
  }

  ctx.font = bodyFont
  ctx.fillStyle = colorScheme.muted
  for (const line of bodyLines) {
    ctx.fillText(line, width / 2, y)
    y += bodyLineHeight
  }
}
