import { useState } from 'react'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from '@mui/material'

import type { SingleCellViewModel } from '../model.ts'

interface CreateGeneSetDialogProps {
  model: SingleCellViewModel
  open: boolean
  onClose: () => void
}

export default function CreateGeneSetDialog({
  model,
  open,
  onClose,
}: CreateGeneSetDialogProps) {
  const [name, setName] = useState('')
  const [genesText, setGenesText] = useState('')

  const genes = genesText
    .split(/[,\n]+/)
    .map(s => s.trim())
    .filter(Boolean)

  const handleSubmit = () => {
    const trimmedName = name.trim()
    if (!trimmedName || genes.length === 0) return
    model.createGeneSet(trimmedName, genes)
    void model.addGeneSet(trimmedName)
    setName('')
    setGenesText('')
    onClose()
  }

  const handleClose = () => {
    setName('')
    setGenesText('')
    onClose()
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Create gene set</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          margin="dense"
          label="Gene set name"
          fullWidth
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault()
            }
          }}
        />
        <TextField
          margin="dense"
          label="Genes"
          placeholder="GENE1, GENE2, GENE3"
          fullWidth
          multiline
          rows={4}
          value={genesText}
          onChange={e => setGenesText(e.target.value)}
          helperText={`${genes.length} gene${genes.length === 1 ? '' : 's'} will be added`}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button
          onClick={handleSubmit}
          disabled={!name.trim() || genes.length === 0}
          variant="contained"
        >
          Create
        </Button>
      </DialogActions>
    </Dialog>
  )
}
