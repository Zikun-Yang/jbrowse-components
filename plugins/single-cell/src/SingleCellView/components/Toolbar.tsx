import { useState } from 'react'
import { observer } from 'mobx-react'
import {
  ToggleButton,
  ToggleButtonGroup,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Chip,
  Button,
  Tooltip,
} from '@mui/material'
import PanToolIcon from '@mui/icons-material/PanTool'
import GestureIcon from '@mui/icons-material/Gesture'
import CropFreeIcon from '@mui/icons-material/CropFree'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import SegmentIcon from '@mui/icons-material/Segment'
import PaletteIcon from '@mui/icons-material/Palette'

import PalettePicker from './PalettePicker.tsx'

import type { SingleCellViewModel } from '../model.ts'

const Toolbar = observer(function Toolbar({
  model,
}: {
  model: SingleCellViewModel
}) {
  const { data, embedding, selectionTool, selectedCells, showLabels } = model
  const [paletteAnchor, setPaletteAnchor] = useState<HTMLButtonElement | null>(
    null,
  )

  if (!data) return null

  const embeddings = data.embeddings

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        flexWrap: 'wrap',
      }}
    >
      {/* Tool selection */}
      <ToggleButtonGroup
        value={selectionTool}
        exclusive
        size="small"
        onChange={(_, value) => {
          if (value) model.setSelectionTool(value)
        }}
      >
        <Tooltip title="Pan" arrow>
          <ToggleButton value="pan" aria-label="Pan">
            <PanToolIcon fontSize="small" />
          </ToggleButton>
        </Tooltip>
        <Tooltip title="Lasso selection" arrow>
          <ToggleButton value="lasso" aria-label="Lasso selection">
            <GestureIcon fontSize="small" />
          </ToggleButton>
        </Tooltip>
        <Tooltip title="Rectangle selection" arrow>
          <ToggleButton value="rect" aria-label="Rectangle selection">
            <CropFreeIcon fontSize="small" />
          </ToggleButton>
        </Tooltip>
      </ToggleButtonGroup>

      {/* Label overlay toggle + palette picker as one connected group */}
      <ToggleButtonGroup size="small" exclusive={false}>
        <Tooltip title="Show labels" arrow>
          <ToggleButton
            value="labels"
            selected={showLabels}
            onChange={() => model.toggleShowLabels()}
            aria-label="Show labels"
          >
            <SegmentIcon fontSize="small" />
          </ToggleButton>
        </Tooltip>
        <Tooltip title="Color palettes" arrow>
          <ToggleButton
            value="palette"
            selected={Boolean(paletteAnchor)}
            onClick={e =>
              setPaletteAnchor(e.currentTarget as HTMLButtonElement)
            }
            aria-label="Color palette settings"
          >
            <PaletteIcon fontSize="small" />
          </ToggleButton>
        </Tooltip>
      </ToggleButtonGroup>

      <PalettePicker
        model={model}
        anchorEl={paletteAnchor}
        onClose={() => setPaletteAnchor(null)}
      />

      {/* Embedding selector */}
      <FormControl size="small" sx={{ minWidth: 120 }}>
        <InputLabel>Embedding</InputLabel>
        <Select
          value={embedding ?? ''}
          label="Embedding"
          onChange={e => model.setEmbedding(e.target.value)}
        >
          {embeddings.map(emb => (
            <MenuItem key={emb} value={emb}>
              {emb}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* Apply selection to BAM filtering */}
      {selectedCells.size > 0 ? (
        <Tooltip title="Apply selection to genome tracks" arrow>
          <Button
            size="small"
            variant="outlined"
            startIcon={<PlayArrowIcon />}
            onClick={() => model.applySelection()}
          >
            Apply
          </Button>
        </Tooltip>
      ) : null}

      {/* Selection count */}
      {selectedCells.size > 0 ? (
        <Chip
          label={`${selectedCells.size.toLocaleString()} selected`}
          size="small"
          onDelete={() => model.clearSelection()}
          color="primary"
        />
      ) : null}
    </Box>
  )
})

export default Toolbar
