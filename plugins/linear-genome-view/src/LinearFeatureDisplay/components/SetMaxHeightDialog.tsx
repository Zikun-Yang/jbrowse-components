import { useState } from 'react'

import { Dialog } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import {
  Button,
  DialogActions,
  DialogContent,
  TextField,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

const useStyles = makeStyles()({
  root: {
    width: 500,
  },
})

const SetMaxHeightDialog = observer(function SetMaxHeightDialog({
  model,
  handleClose,
}: {
  model: {
    maxHeight?: number
    setMaxHeight: (arg?: number) => void
  }
  handleClose: () => void
}) {
  const { classes } = useStyles()
  const { maxHeight = '' } = model
  const [max, setMax] = useState(`${maxHeight}`)
  const ok = max !== '' && !Number.isNaN(+max)
  return (
    <Dialog open onClose={handleClose} title="Set max layout height">
      <DialogContent className={classes.root}>
        <Typography>
          Set the maximum layout height for the track, i.e. how many stacked
          feature rows the renderer may draw. Increase it if the layout says
          &quot;Max height reached&quot;. This is not the visible track height -
          drag the track edge for that.
        </Typography>
        <TextField
          value={max}
          onChange={event => {
            setMax(event.target.value)
          }}
          placeholder="Enter max layout height"
        />
        {!ok ? <div style={{ color: 'red' }}>Invalid number</div> : null}
      </DialogContent>
      <DialogActions>
        <Button
          variant="contained"
          color="primary"
          type="submit"
          autoFocus
          disabled={!ok}
          onClick={() => {
            model.setMaxHeight(+max)
            handleClose()
          }}
        >
          Submit
        </Button>
        <Button
          variant="contained"
          color="secondary"
          onClick={() => {
            handleClose()
          }}
        >
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  )
})

export default SetMaxHeightDialog
