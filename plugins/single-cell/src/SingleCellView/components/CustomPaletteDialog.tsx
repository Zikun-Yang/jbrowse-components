import { useState } from 'react'
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'

interface CustomPaletteDialogProps {
  open: boolean
  onClose: () => void
  onSaveCategorical: (name: string, colors: string[]) => void
  onSaveContinuous: (name: string, stops: string[]) => void
  existingCategoricalNames: string[]
  existingContinuousNames: string[]
}

function ColorInput({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  return (
    <Box sx={{ position: 'relative', width: 32, height: 32, flexShrink: 0 }}>
      <Box
        sx={{
          width: 32,
          height: 32,
          borderRadius: 1,
          border: '1px solid rgba(0,0,0,0.2)',
          backgroundColor: value,
          cursor: 'pointer',
        }}
        onClick={() => {
          const input = document.createElement('input')
          input.type = 'color'
          input.value = value
          input.style.position = 'fixed'
          input.style.opacity = '0'
          input.style.pointerEvents = 'none'
          document.body.appendChild(input)
          const cleanup = () => {
            try {
              document.body.removeChild(input)
            } catch {
              // already removed
            }
          }
          input.addEventListener('change', e => {
            onChange((e.target as HTMLInputElement).value)
            cleanup()
          })
          input.addEventListener('blur', cleanup, { once: true })
          input.click()
        }}
      />
    </Box>
  )
}

export default function CustomPaletteDialog({
  open,
  onClose,
  onSaveCategorical,
  onSaveContinuous,
  existingCategoricalNames,
  existingContinuousNames,
}: CustomPaletteDialogProps) {
  const [tab, setTab] = useState(0)
  const [name, setName] = useState('')
  const [catColors, setCatColors] = useState<string[]>(['#1f77b4', '#ff7f0e'])
  const [contStops, setContStops] = useState<string[]>([
    '#440154',
    '#31688e',
    '#35b779',
    '#fde725',
  ])

  const reset = () => {
    setName('')
    setCatColors(['#1f77b4', '#ff7f0e'])
    setContStops(['#440154', '#31688e', '#35b779', '#fde725'])
    setTab(0)
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleSave = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    if (tab === 0) {
      onSaveCategorical(trimmed, catColors)
    } else {
      onSaveContinuous(trimmed, contStops)
    }
    handleClose()
  }

  const isDuplicate =
    tab === 0
      ? existingCategoricalNames.includes(name.trim())
      : existingContinuousNames.includes(name.trim())

  const isValid = name.trim().length > 0 && !isDuplicate

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add custom palette</DialogTitle>
      <DialogContent>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
          <Tab label="Categorical" />
          <Tab label="Continuous" />
        </Tabs>

        <TextField
          label="Palette name"
          value={name}
          onChange={e => setName(e.target.value)}
          fullWidth
          size="small"
          error={isDuplicate}
          helperText={
            isDuplicate ? 'A palette with this name already exists' : undefined
          }
          sx={{ mb: 2 }}
        />

        {tab === 0 ? (
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Colors ({catColors.length})
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>
              {catColors.map((color, i) => (
                <Box key={i} sx={{ display: 'flex', alignItems: 'center' }}>
                  <ColorInput
                    value={color}
                    onChange={next => {
                      const nextColors = [...catColors]
                      nextColors[i] = next
                      setCatColors(nextColors)
                    }}
                  />
                  <IconButton
                    size="small"
                    onClick={() => {
                      setCatColors(catColors.filter((_, idx) => idx !== i))
                    }}
                    disabled={catColors.length <= 1}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              ))}
            </Box>
            <Button
              size="small"
              startIcon={<AddIcon />}
              onClick={() => setCatColors([...catColors, '#808080'])}
            >
              Add color
            </Button>
          </Box>
        ) : (
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Gradient stops ({contStops.length})
            </Typography>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                mb: 1,
                p: 1,
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                background: `linear-gradient(to right, ${contStops.join(', ')})`,
              }}
            />
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>
              {contStops.map((color, i) => (
                <Box key={i} sx={{ display: 'flex', alignItems: 'center' }}>
                  <ColorInput
                    value={color}
                    onChange={next => {
                      const nextStops = [...contStops]
                      nextStops[i] = next
                      setContStops(nextStops)
                    }}
                  />
                  <IconButton
                    size="small"
                    onClick={() => {
                      setContStops(contStops.filter((_, idx) => idx !== i))
                    }}
                    disabled={contStops.length <= 2}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              ))}
            </Box>
            <Button
              size="small"
              startIcon={<AddIcon />}
              onClick={() => setContStops([...contStops, '#808080'])}
            >
              Add stop
            </Button>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button onClick={handleSave} variant="contained" disabled={!isValid}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  )
}
