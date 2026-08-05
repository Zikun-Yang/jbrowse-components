import { Link } from '@mui/material'

import { OpenInNewIcon } from '@jbrowse/core/ui/Icons'

import type { LinkProps } from '@mui/material'

export default function ExternalLink(props: LinkProps) {
  const { children, ...rest } = props
  return (
    <Link {...rest} target="_blank" rel="noopener noreferrer">
      {children} <OpenInNewIcon fontSize="small" />
    </Link>
  )
}
