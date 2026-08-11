import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import { observer } from 'mobx-react'

import { PaletteIcon } from '@jbrowse/core/ui/Icons'

import type { LinearSyntenyDisplayModel } from '../../LinearSyntenyDisplay/model.ts'
import type { LinearComparativeViewModel } from '../model.ts'

const ColorBySelector = observer(function ColorBySelector({
  model,
}: {
  model: LinearComparativeViewModel
}) {
  // Get the first display from the first level (if it exists)
  const firstDisplay = model.levels[0]?.tracks[0]?.displays[0] as
    | LinearSyntenyDisplayModel
    | undefined

  const colorBy = firstDisplay?.colorBy ?? 'strand'

  const setColorBy = (value: string) => {
    // Set colorBy for all displays across all levels
    for (const level of model.levels) {
      for (const track of level.tracks) {
        for (const display of track.displays) {
          ;(display as LinearSyntenyDisplayModel).setColorBy(value)
        }
      }
    }
  }

  return (
    <CascadingMenuButton
      menuItems={[
        {
          label: 'Strand',
          type: 'radio',
          checked: colorBy === 'strand',
          onClick: () => {
            setColorBy('strand')
          },
          helpText:
            'Color alignments by strand orientation. Forward strand alignments are gray and reverse strand alignments use the theme primary color, making inversions easy to spot.',
        },
        {
          label: 'Identity',
          type: 'radio',
          checked: colorBy === 'identity',
          onClick: () => {
            setColorBy('identity')
          },
          helpText:
            'Color alignments by sequence identity: 85% or below is the theme primary color (green), 100% is red, with yellow in between. Alignments without identity information are shown in gray.',
        },
        {
          label: 'Query position (rainbow)',
          subMenu: model.views.map((view, i) => ({
            label: view.assemblyNames.join(', ') || `Genome ${i + 1}`,
            type: 'radio' as const,
            checked: colorBy === 'rainbow' && model.rainbowAnchor === i,
            onClick: () => {
              model.setRainbowAnchor(i)
              setColorBy('rainbow')
            },
          })),
          helpText:
            "Color alignments by where they map onto the anchor genome, as a rainbow along each chromosome from 5' (blue) to 3' (red). Displays not adjacent to the anchor genome are colored by chaining through the alignments in between; regions that cannot be mapped to the anchor are shown in gray.",
        },
      ]}
    >
      <PaletteIcon />
    </CascadingMenuButton>
  )
})

export default ColorBySelector
