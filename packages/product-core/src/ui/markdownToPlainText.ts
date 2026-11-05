/**
 * Turn the markdown produced by `formatAbout.info` into prompt-friendly plain
 * text.
 *
 * The "About this track" dialog renders markdown (`MarkdownContent`), but the
 * agent SDK hands the same text to a language model, where `#`, `**` and `|`
 * are noise that costs tokens and confuses "quote the track description"
 * tasks. This is a deliberately small, dependency-free approximation of the
 * subset `MarkdownContent` supports (headings, paragraphs, lists, tables,
 * fenced/inline code, emphasis, links, images, blockquotes) — not a general
 * markdown parser, and it never throws.
 *
 * Rules:
 *
 * - structure is flattened to lines and blank lines between blocks, so a
 *   heading reads as its own line and a list item keeps one line per item
 * - link and image targets are kept as `label (url)`; `hideUris` callers
 *   already removed the url from the markdown, so nothing to do there
 * - code block contents are kept verbatim (minus the fence), inline code loses
 *   its backticks
 * - a table row becomes `cell | cell | cell`, the `|---|` separator row is
 *   dropped
 */
export function markdownToPlainText(markdown: string): string {
  if (typeof markdown !== 'string' || markdown.trim() === '') {
    return ''
  }

  const text = markdown.replace(/\r\n?/g, '\n').split('\n')
  const output: string[] = []
  let inFence = false

  for (const rawLine of text) {
    const line = rawLine.replace(/\s+$/, '')

    // fenced code blocks keep their content (it is often a config snippet)
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence
      continue
    }
    if (inFence) {
      output.push(line)
      continue
    }

    // horizontal rules
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      output.push('')
      continue
    }

    // table separator row: | --- | :---: |
    if (/^\s*\|?[\s:-]*-[\s|:-]*$/.test(line) && line.includes('-')) {
      continue
    }

    let value = line
      // headings
      .replace(/^\s{0,3}#{1,6}\s+/, '')
      // blockquote markers (may nest)
      .replace(/^\s{0,3}(?:>\s?)+/, '')
      // unordered and ordered list markers, keeping the item text
      .replace(/^\s*[-*+]\s+/, '')
      .replace(/^\s*\d+[.)]\s+/, '')

    if (value.trimStart().startsWith('|')) {
      // table row: drop the outer pipes, keep cell boundaries visible
      value = value
        .trim()
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split('|')
        .map(cell => cell.trim())
        .filter(cell => cell !== '')
        .join(' | ')
    }

    output.push(stripInline(value))
  }

  return output
    .join('\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function stripInline(value: string): string {
  return (
    value
      // images: ![alt](url) -> alt (url)
      .replace(/!\[([^\]]*)\]\(([^)\s]*)(?:\s+"[^"]*")?\)/g, (_m, alt, url) =>
        joinLabelAndUrl(alt, url),
      )
      // links: [label](url) -> label (url)
      .replace(/\[([^\]]*)\]\(([^)\s]*)(?:\s+"[^"]*")?\)/g, (_m, label, url) =>
        joinLabelAndUrl(label, url),
      )
      // autolinks: <https://…> -> https://…
      .replace(/<((?:https?|mailto):[^>\s]+)>/gi, '$1')
      // inline html tags (the dialog skips html entirely)
      .replace(/<\/?[a-z][^>]*>/gi, '')
      // inline code
      .replace(/`+([^`]*)`+/g, '$1')
      // strikethrough
      .replace(/~~([^~]+)~~/g, '$1')
      // strong then emphasis, longest marker first; underscores inside an
      // identifier (`file_name_here`) are not emphasis, so `_` needs word
      // boundaries on both sides
      .replace(/\*\*\*(\S(?:.*?\S)?)\*\*\*/g, '$1')
      .replace(/\*\*(\S(?:.*?\S)?)\*\*/g, '$1')
      .replace(/(?<![\w])__(\S(?:.*?\S)?)__(?![\w])/g, '$1')
      .replace(/\*(\S(?:.*?\S)?)\*/g, '$1')
      .replace(/(?<![\w])_(\S(?:.*?\S)?)_(?![\w])/g, '$1')
      // escaped punctuation: \* -> *
      .replace(/\\([\\`*_{}[\]()#+\-.!|>~])/g, '$1')
      .replace(/[ \t]{2,}/g, ' ')
      .trim()
  )
}

function joinLabelAndUrl(label: string, url: string): string {
  const text = label.trim()
  const target = url.trim()
  if (!target || target === text) {
    return text
  }
  return text ? `${text} (${target})` : target
}
