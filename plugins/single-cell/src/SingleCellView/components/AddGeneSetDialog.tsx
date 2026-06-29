import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Tooltip,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'

import type { SingleCellViewModel } from '../model.ts'

interface AddGeneSetDialogProps {
  model: SingleCellViewModel
  open: boolean
  onClose: () => void
}

export default function AddGeneSetDialog({
  model,
  open,
  onClose,
}: AddGeneSetDialogProps) {
  const { geneSets, activeGeneSets } = model
  const available = Array.from(geneSets.keys()).filter(
    name => !activeGeneSets.includes(name),
  )

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add gene set</DialogTitle>
      <DialogContent>
        {available.length === 0 ? (
          <Typography color="textSecondary">
            All created gene sets are already in the sidebar.
          </Typography>
        ) : (
          <List dense disablePadding>
            {available.map(name => {
              const genes = geneSets.get(name) ?? []
              return (
                <ListItem
                  key={name}
                  disablePadding
                  secondaryAction={
                    <>
                      <Tooltip title="Add to sidebar">
                        <IconButton
                          edge="end"
                          size="small"
                          onClick={() => {
                            void model.addGeneSet(name)
                            if (available.length === 1) {
                              onClose()
                            }
                          }}
                        >
                          <AddIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete gene set">
                        <IconButton
                          edge="end"
                          size="small"
                          onClick={() => model.deleteGeneSet(name)}
                          sx={{ ml: 0.5 }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </>
                  }
                >
                  <ListItemButton
                    onClick={() => {
                      void model.addGeneSet(name)
                      if (available.length === 1) {
                        onClose()
                      }
                    }}
                  >
                    <ListItemText
                      primary={name}
                      secondary={`${genes.length} gene${
                        genes.length === 1 ? '' : 's'
                      }`}
                    />
                  </ListItemButton>
                </ListItem>
              )
            })}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  )
}
