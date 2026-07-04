import { createJBrowseTheme } from '@jbrowse/core/ui'
// @ts-expect-error
import { createTestSession } from '@jbrowse/web/src/rootModel/index.js'
import { ThemeProvider } from '@mui/material'
import { render } from '@testing-library/react'

import SpeciesSelector from './SpeciesSelector.tsx'

jest.mock('@jbrowse/web/src/makeWorkerInstance', () => () => {})

const assemblyConfs = [
  {
    name: 'hg38',
    species: 'Homo sapiens',
    sequence: {
      trackId: 'sequenceConfigId',
      type: 'ReferenceSequenceTrack',
      adapter: {
        type: 'FromConfigSequenceAdapter',
        features: [
          { refName: 'chr1', uniqueId: '1', start: 0, end: 10, seq: 'a' },
        ],
      },
    },
  },
  {
    name: 'mm39',
    species: 'Mus musculus',
    sequence: {
      trackId: 'sequenceConfigId2',
      type: 'ReferenceSequenceTrack',
      adapter: {
        type: 'FromConfigSequenceAdapter',
        features: [
          { refName: 'chr1', uniqueId: '2', start: 0, end: 10, seq: 'a' },
        ],
      },
    },
  },
  {
    name: 'volvox',
    sequence: {
      trackId: 'sequenceConfigId3',
      type: 'ReferenceSequenceTrack',
      adapter: {
        type: 'FromConfigSequenceAdapter',
        features: [
          { refName: 'ctgA', uniqueId: '3', start: 0, end: 10, seq: 'a' },
        ],
      },
    },
  },
]

function Wrapper({ children }: { children: React.ReactNode }) {
  return <ThemeProvider theme={createJBrowseTheme()}>{children}</ThemeProvider>
}

test('renders null when no species are configured', () => {
  const session = createTestSession()
  const { container } = render(
    <Wrapper>
      <SpeciesSelector session={session} onChange={() => {}} />
    </Wrapper>,
  )
  expect(container.firstChild).toBeNull()
})

test('lists unique sorted species', () => {
  const session = createTestSession({
    jbrowseConfig: { assemblies: assemblyConfs },
  })
  const { getByRole } = render(
    <Wrapper>
      <SpeciesSelector session={session} onChange={() => {}} />
    </Wrapper>,
  )
  const combobox = getByRole('combobox')
  expect(combobox).toBeTruthy()
})

test('calls onChange with selected species', () => {
  const session = createTestSession({
    jbrowseConfig: { assemblies: assemblyConfs },
  })
  const onChange = jest.fn()
  const { getByRole } = render(
    <Wrapper>
      <SpeciesSelector
        session={session}
        selected="Homo sapiens"
        onChange={onChange}
      />
    </Wrapper>,
  )
  const combobox = getByRole('combobox') as HTMLInputElement
  expect(combobox.value).toBe('Homo sapiens')
})
