import { useMemo } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { safeUrlTransform } from './markdownUrlTransform.ts'

import type { Components } from 'react-markdown'

// stable identity, react-markdown rebuilds its processor when this changes
const remarkPlugins = [remarkGfm]

const useStyles = makeStyles()(theme => ({
  root: {
    color: theme.palette.text.primary,
    overflowWrap: 'anywhere',
    '& > :first-child': {
      marginTop: 0,
    },
    '& > :last-child': {
      marginBottom: 0,
    },
    '& h1, & h2, & h3, & h4, & h5, & h6': {
      color: theme.palette.text.primary,
      lineHeight: 1.3,
      marginBottom: theme.spacing(1),
      marginTop: theme.spacing(2),
    },
    '& h1': { fontSize: '1.5rem' },
    '& h2': { fontSize: '1.3rem' },
    '& h3': { fontSize: '1.15rem' },
    '& h4, & h5, & h6': { fontSize: '1rem' },
    '& p': {
      lineHeight: 1.6,
      marginBottom: theme.spacing(1),
      marginTop: 0,
    },
    '& ul, & ol': {
      marginBottom: theme.spacing(1),
      marginTop: 0,
      paddingLeft: theme.spacing(3),
    },
    '& li': {
      lineHeight: 1.6,
      marginBottom: theme.spacing(0.5),
    },
    '& a': {
      color: theme.palette.primary.main,
    },
    '& img': {
      maxWidth: '100%',
    },
    '& table': {
      borderCollapse: 'collapse',
      marginBottom: theme.spacing(1.5),
    },
    '& th, & td': {
      border: `1px solid ${theme.palette.divider}`,
      padding: theme.spacing(0.5, 1.5),
      textAlign: 'left',
    },
    '& th': {
      backgroundColor: theme.palette.action.hover,
      fontWeight: 600,
    },
    '& code': {
      backgroundColor: theme.palette.action.hover,
      borderRadius: 3,
      fontFamily: 'monospace',
      padding: '1px 4px',
    },
    '& pre': {
      backgroundColor: theme.palette.action.hover,
      borderRadius: 3,
      marginBottom: theme.spacing(1.5),
      overflowX: 'auto',
      padding: theme.spacing(1.5),
    },
    '& pre code': {
      backgroundColor: 'transparent',
      padding: 0,
    },
    '& blockquote': {
      borderLeft: `4px solid ${theme.palette.divider}`,
      color: theme.palette.text.secondary,
      margin: 0,
      marginBottom: theme.spacing(1),
      paddingLeft: theme.spacing(2),
    },
    '& hr': {
      border: 0,
      borderTop: `1px solid ${theme.palette.divider}`,
      marginBottom: theme.spacing(2),
      marginTop: theme.spacing(2),
    },
  },
}))

/**
 * Markdown renderer for user supplied text (e.g. `formatAbout.info`).
 *
 * Supported markdown: headings, paragraphs, lists, tables (gfm), fenced code,
 * inline code, bold/italic/strikethrough, links, images and blockquotes.
 *
 * Safety notes:
 *
 * - raw HTML is skipped (`skipHtml`), no `rehype-raw` is used, so inline HTML
 *   can never become executable markup
 * - links and images go through `safeUrlTransform`, which only allows http(s),
 *   mailto, fragments and (unless `hideUris` is set) relative paths
 *
 * This module is intentionally not imported directly, see `MarkdownPanel` which
 * loads it lazily to keep `react-markdown` out of the main bundle.
 */
export default function MarkdownContent({
  markdown,
  hideUris = false,
}: {
  markdown: string
  hideUris?: boolean
}) {
  const { classes } = useStyles()

  const components = useMemo<Components>(
    () => ({
      a({ href, children }) {
        // the url was already filtered by urlTransform, an empty href means the
        // link target was rejected (e.g. javascript:) or hidden (local path)
        if (!href) {
          return <span>{children}</span>
        }
        return /^https?:/i.test(href) ? (
          <a href={href} target="_blank" rel="noopener noreferrer">
            {children}
          </a>
        ) : (
          <a href={href}>{children}</a>
        )
      },
      img({ src, alt }) {
        if (!src) {
          return <span>{alt ?? ''}</span>
        }
        return <img src={src} alt={alt ?? ''} />
      },
    }),
    [],
  )

  return (
    <div className={classes.root}>
      <ReactMarkdown
        skipHtml
        remarkPlugins={remarkPlugins}
        urlTransform={url => safeUrlTransform(url, hideUris)}
        components={components}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  )
}
