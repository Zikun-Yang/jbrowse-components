import { Box, Button, Typography } from '@mui/material'

import type { Transform } from '../model.ts'

interface HistogramTransformToggleProps {
  xTransform: Transform
  yTransform: Transform
  onChange: (axis: 'x' | 'y', transform: Transform) => void
}

export default function HistogramTransformToggle({
  xTransform,
  yTransform,
  onChange,
}: HistogramTransformToggleProps) {
  const renderButton = (
    axis: 'x' | 'y',
    transform: Transform,
    current: Transform,
  ) => {
    const isActive = current === transform
    return (
      <Button
        size="small"
        onClick={() => {
          if (current !== transform) {
            onChange(axis, transform)
          }
        }}
        sx={{
          minWidth: 0,
          px: 0.75,
          py: 0,
          color: isActive ? 'primary.main' : 'text.secondary',
          fontWeight: isActive ? 600 : 400,
          textTransform: 'lowercase',
          borderRadius: 0,
          fontSize: 12,
          lineHeight: 1.5,
        }}
      >
        {transform}
      </Button>
    )
  }

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        mb: 1,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
        <Typography
          variant="caption"
          color="textSecondary"
          sx={{ fontSize: 12, mr: 0.25 }}
        >
          X
        </Typography>
        {renderButton('x', 'linear', xTransform)}
        <Typography variant="caption" color="textSecondary">
          |
        </Typography>
        {renderButton('x', 'log', xTransform)}
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
        <Typography
          variant="caption"
          color="textSecondary"
          sx={{ fontSize: 12, mr: 0.25 }}
        >
          Y
        </Typography>
        {renderButton('y', 'linear', yTransform)}
        <Typography variant="caption" color="textSecondary">
          |
        </Typography>
        {renderButton('y', 'log', yTransform)}
      </Box>
    </Box>
  )
}
