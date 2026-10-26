/**
 * The markdown template renderer now lives in `@jbrowse/core` so that every
 * track can use it, this re-export keeps the feature-chart drawer API stable.
 */
export {
  renderTemplate as renderMarkdownTemplate,
  resolveTemplatePath,
  stringifyTemplateValue,
} from '@jbrowse/core/util/renderTemplate'

export type { TemplateContext } from '@jbrowse/core/util/renderTemplate'
