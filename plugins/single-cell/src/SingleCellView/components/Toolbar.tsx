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
} from '@mui/material'
import PanToolIcon from '@mui/icons-material/PanTool'
import GestureIcon from '@mui/icons-material/Gesture'
import CropFreeIcon from '@mui/icons-material/CropFree'

import type { SingleCellViewModel } from '../model.ts'

const Toolbar = observer(function Toolbar({
  model,
}: {
  model: SingleCellViewModel
}) {
  const { data, embedding, colorBy, selectionTool, selectedCells } = model

  if (!data) return null

  const embeddings = data.embeddings
  const obsColumns = data.obsColumns

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        p: 1,
        borderBottom: '1px solid',
        borderColor: 'divider',
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
        <ToggleButton value="pan">
          <PanToolIcon fontSize="small" />
        </ToggleButton>
        <ToggleButton value="lasso">
          <GestureIcon fontSize="small" />
        </ToggleButton>
        <ToggleButton value="rect">
          <CropFreeIcon fontSize="small" />
        </ToggleButton>
      </ToggleButtonGroup>

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

      {/* Color by selector */}
      <FormControl size="small" sx={{ minWidth: 120 }}>
        <InputLabel>Color by</InputLabel>
        <Select
          value={colorBy ?? ''}
          label="Color by"
          onChange={e => model.setColorBy(e.target.value)}
        >
          {obsColumns.map(col => (
            <MenuItem key={col} value={col}>
              {col}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

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
