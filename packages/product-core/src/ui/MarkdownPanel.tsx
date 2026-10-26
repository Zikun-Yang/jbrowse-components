import { Suspense, lazy } from 'react'

// react-markdown plus its unified/mdast pipeline is ~36 kB gzipped, it is only
// needed when the about dialog is opened so it lives in its own chunk
const MarkdownContent = lazy(() => import('./MarkdownContent.tsx'))

/**
 * Render a user supplied markdown string (e.g. `formatAbout.info`) with the
 * app theme. Raw HTML is never rendered and only http(s)/mailto/fragment/
 * relative urls are allowed, see `safeUrlTransform`.
 */
export default function MarkdownPanel({
  markdown,
  hideUris = false,
}: {
  markdown: string
  hideUris?: boolean
}) {
  return (
    <Suspense fallback={null}>
      <MarkdownContent markdown={markdown} hideUris={hideUris} />
    </Suspense>
  )
}
