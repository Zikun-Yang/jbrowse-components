import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Tooltip } from '@mui/material'

import {
  StarBorderIcon as StarBorder,
  StarIcon as Star,
} from '@jbrowse/core/ui/Icons'

const useStyles = makeStyles()({
  starIcon: {
    marginLeft: 4,
    fontSize: 16,
    color: 'darkorange',
    cursor: 'pointer',
  },
  starIconEmpty: {
    marginLeft: 4,
    fontSize: 16,
    color: 'black',
    cursor: 'pointer',
  },
})

export default function StarIcon({
  isFavorite,
  onClick,
}: {
  isFavorite: boolean
  onClick: () => void
}) {
  const { classes } = useStyles()
  return (
    <Tooltip title="Favorite">
      {isFavorite ? (
        <Star className={classes.starIcon} onClick={onClick} />
      ) : (
        <StarBorder className={classes.starIconEmpty} onClick={onClick} />
      )}
    </Tooltip>
  )
}
