interface TemplateContext {
  name: string
  chrom?: string
  start?: number
  end?: number
  data?: unknown
}

export function renderMarkdownTemplate(
  template: string,
  context: TemplateContext,
): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, path) => {
    const value = resolvePath(context, path)
    return value !== undefined ? String(value) : ''
  })
}

function resolvePath(context: TemplateContext, path: string): unknown {
  const parts = path.split('.')
  let value: unknown = context as unknown
  for (const part of parts) {
    if (value === null || value === undefined) {
      return undefined
    }
    if (typeof value === 'object') {
      value = (value as Record<string, unknown>)[part]
    } else {
      return undefined
    }
  }
  return value
}
