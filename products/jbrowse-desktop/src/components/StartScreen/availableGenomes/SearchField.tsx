import { makeStyles } from '@jbrowse/core/util/tss-react'
import { InputAdornment, TextField } from '@mui/material'

import { SearchIcon as Search } from '@jbrowse/core/ui/Icons'

const useStyles = makeStyles()({
  root: {
    margin: 0,
    marginLeft: 10,
  },
})

interface SearchFieldProps {
  searchQuery: string
  onChange: (value: string) => void
}

export default function SearchField({
  searchQuery,
  onChange,
}: SearchFieldProps) {
  const { classes } = useStyles()

  return (
    <TextField
      type="text"
      placeholder="Search genomes..."
      value={searchQuery}
      onChange={e => {
        onChange(e.target.value)
      }}
      variant="outlined"
      size="small"
      className={classes.root}
      style={{ minWidth: 200 }}
      slotProps={{
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <Search fontSize="small" />
            </InputAdornment>
          ),
        },
      }}
    />
  )
}
