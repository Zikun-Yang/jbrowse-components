import { createJBrowseTheme } from '@jbrowse/core/ui'
// @ts-expect-error
import { createTestSession } from '@jbrowse/web/src/rootModel/index.js'
import { ThemeProvider } from '@mui/material'
import { render, waitFor } from '@testing-library/react'

import AssemblySelector from './AssemblySelector.tsx'

jest.mock('@jbrowse/web/src/makeWorkerInstance', () => () => {})

const assemblyConfs = [
  {
    name: 'hg38',
    displayName: 'Human (GRCh38/hg38)',
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
    displayName: 'Mouse (GRCm39/mm39)',
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

test('renders all assemblies when no species filter', async () => {
  const session = createTestSession({
    jbrowseConfig: { assemblies: assemblyConfs },
  })
  const onChange = jest.fn()
  const { getByRole } = render(
    <Wrapper>
      <AssemblySelector session={session} onChange={onChange} />
    </Wrapper>,
  )
  const combobox = getByRole('combobox') as HTMLInputElement
  await waitFor(() => {
    expect(combobox.value).toBe('Human (GRCh38/hg38)')
  })
})

test('filters assemblies by species', async () => {
  const session = createTestSession({
    jbrowseConfig: { assemblies: assemblyConfs },
  })
  const onChange = jest.fn()
  const { getByRole } = render(
    <Wrapper>
      <AssemblySelector
        session={session}
        species="Mus musculus"
        selected="mm39"
        onChange={onChange}
      />
    </Wrapper>,
  )
  const combobox = getByRole('combobox') as HTMLInputElement
  await waitFor(() => {
    expect(combobox.value).toBe('Mouse (GRCm39/mm39)')
  })
})

test('falls back to first matching assembly when selection is filtered out', async () => {
  const session = createTestSession({
    jbrowseConfig: { assemblies: assemblyConfs },
  })
  const onChange = jest.fn()
  render(
    <Wrapper>
      <AssemblySelector
        session={session}
        species="Mus musculus"
        selected="hg38"
        onChange={onChange}
      />
    </Wrapper>,
  )
  await waitFor(() => {
    expect(onChange).toHaveBeenCalledWith('mm39')
  })
})

test('shows error when no assemblies are configured', () => {
  const session = createTestSession()
  const { getByText } = render(
    <Wrapper>
      <AssemblySelector session={session} onChange={() => {}} />
    </Wrapper>,
  )
  expect(getByText('No configured assemblies')).toBeTruthy()
})
