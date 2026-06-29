import { useEffect, useState } from 'react'
import { observer } from 'mobx-react'
import {
  Box,
  Button,
  Divider,
  IconButton,
  Popover,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'

import {
  CATEGORICAL_PALETTES,
  CONTINUOUS_PALETTES,
  getAllCategoricalPaletteNames,
  getAllContinuousPaletteNames,
  getContinuousHex,
  registerCustomCategoricalPalette,
  registerCustomContinuousPalette,
  removeCustomCategoricalPalette,
  removeCustomContinuousPalette,
} from './colorUtils.ts'
import CustomPaletteDialog from './CustomPaletteDialog.tsx'

import type { SingleCellViewModel } from '../model.ts'

interface PalettePickerProps {
  model: SingleCellViewModel
  anchorEl: HTMLButtonElement | null
  onClose: () => void
}

export default observer(function PalettePicker({
  model,
  anchorEl,
  onClose,
}: PalettePickerProps) {
  const open = Boolean(anchorEl)
  const [dialogOpen, setDialogOpen] = useState(false)

  // Keep colorUtils custom palette registry in sync with model state so that
  // rendering components (EmbeddingCanvas, histograms, etc.) can resolve custom
  // palette names without receiving them as props.
  useEffect(() => {
    for (const [name, colors] of Object.entries(model.customCategoricalPalettes)) {
      registerCustomCategoricalPalette(name, colors)
    }
    for (const [name, stops] of Object.entries(model.customContinuousPalettes)) {
      registerCustomContinuousPalette(name, stops)
    }
  }, [model.customCategoricalPalettes, model.customContinuousPalettes])

  const catPalettes = getAllCategoricalPaletteNames()
  const contPalettes = getAllContinuousPaletteNames()
  const presetCatNames = new Set(Object.keys(CATEGORICAL_PALETTES))
  const presetContNames = new Set(Object.keys(CONTINUOUS_PALETTES))

  return (
    <>
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={onClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      >
        <Box sx={{ p: 2, width: 320 }}>
          <Typography variant="subtitle2" gutterBottom>
            Categorical palette
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {catPalettes.map(name => {
              const palette =
                CATEGORICAL_PALETTES[name] ?? model.customCategoricalPalettes[name]
              const selected = model.categoricalPalette === name
              const isCustom = !presetCatNames.has(name)
              return (
                <Box
                  key={name}
                  sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                >
                  <Button
                    size="small"
                    variant="outlined"
                    color="inherit"
                    onClick={() => model.setCategoricalPalette(name)}
                    sx={{
                      flex: 1,
                      justifyContent: 'flex-start',
                      textTransform: 'none',
                      borderColor: selected ? 'primary.main' : 'divider',
                      backgroundColor: selected
                        ? 'rgba(25, 118, 210, 0.08)'
                        : 'transparent',
                    }}
                    startIcon={
                      palette ? (
                        <Box sx={{ display: 'flex', gap: 0.25 }}>
                          {palette.slice(0, 8).map((color, i) => (
                            <Box
                              key={i}
                              sx={{
                                width: 10,
                                height: 10,
                                backgroundColor: color,
                                border: '1px solid rgba(0,0,0,0.1)',
                              }}
                            />
                          ))}
                        </Box>
                      ) : null
                    }
                  >
                    {name}
                  </Button>
                  {isCustom ? (
                    <IconButton
                      size="small"
                      onClick={() => {
                        model.removeCustomCategoricalPalette(name)
                        removeCustomCategoricalPalette(name)
                      }}
                      sx={{ p: 0.25 }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  ) : null}
                </Box>
              )
            })}
          </Box>

          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={() => setDialogOpen(true)}
            sx={{ mt: 1 }}
          >
            Add custom
          </Button>

          <Divider sx={{ my: 1.5 }} />

          <Typography variant="subtitle2" gutterBottom>
            Continuous palette
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {contPalettes.map(name => {
              const selected = model.continuousPalette === name
              const isCustom = !presetContNames.has(name)
              const customStops = model.customContinuousPalettes[name]
              return (
                <Box
                  key={name}
                  sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                >
                  <Button
                    size="small"
                    variant="outlined"
                    color="inherit"
                    onClick={() => model.setContinuousPalette(name)}
                    sx={{
                      flex: 1,
                      justifyContent: 'flex-start',
                      textTransform: 'none',
                      borderColor: selected ? 'primary.main' : 'divider',
                      backgroundColor: selected
                        ? 'rgba(25, 118, 210, 0.08)'
                        : 'transparent',
                    }}
                    startIcon={
                      <Box
                        sx={{
                          width: 80,
                          height: 12,
                          background: customStops
                            ? `linear-gradient(to right, ${customStops.join(', ')})`
                            : `linear-gradient(to right, ${Array.from(
                                { length: 8 },
                                (_, i) => getContinuousHex(i / 7, name),
                              ).join(', ')})`,
                          border: '1px solid rgba(0,0,0,0.1)',
                        }}
                      />
                    }
                  >
                    {name}
                  </Button>
                  {isCustom ? (
                    <IconButton
                      size="small"
                      onClick={() => {
                        model.removeCustomContinuousPalette(name)
                        removeCustomContinuousPalette(name)
                      }}
                      sx={{ p: 0.25 }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  ) : null}
                </Box>
              )
            })}
          </Box>

          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={() => setDialogOpen(true)}
            sx={{ mt: 1 }}
          >
            Add custom
          </Button>
        </Box>
      </Popover>

      <CustomPaletteDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSaveCategorical={(name, colors) => {
          model.addCustomCategoricalPalette(name, colors)
          registerCustomCategoricalPalette(name, colors)
        }}
        onSaveContinuous={(name, stops) => {
          model.addCustomContinuousPalette(name, stops)
          registerCustomContinuousPalette(name, stops)
        }}
        existingCategoricalNames={catPalettes}
        existingContinuousNames={contPalettes}
      />
    </>
  )
})
