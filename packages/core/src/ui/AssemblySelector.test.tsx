import { createJBrowseTheme } from '@jbrowse/core/ui'
// @ts-expect-error
import { createTestSession } from '@jbrowse/web/src/rootModel/index.js'
import { ThemeProvider } from '@mui/material'
import { fireEvent, render, waitFor } from '@testing-library/react'

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

test('renders empty by default', async () => {
  const session = createTestSession({
    jbrowseConfig: { assemblies: assemblyConfs },
  })
  const onChange = jest.fn()
  const { getByRole, container } = render(
    <Wrapper>
      <AssemblySelector session={session} onChange={onChange} />
    </Wrapper>,
  )
  const combobox = getByRole('combobox') as HTMLInputElement
  await waitFor(() => {
    expect(combobox.value).toBe('')
  })
  const label = container.querySelector('label')
  expect(label?.getAttribute('data-shrink')).toBe('false')
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

test('does not fall back when selection is filtered out', async () => {
  const session = createTestSession({
    jbrowseConfig: { assemblies: assemblyConfs },
  })
  const onChange = jest.fn()
  const { getByRole } = render(
    <Wrapper>
      <AssemblySelector
        session={session}
        species="Mus musculus"
        selected="hg38"
        onChange={onChange}
      />
    </Wrapper>,
  )
  const combobox = getByRole('combobox') as HTMLInputElement
  await waitFor(() => {
    expect(combobox.value).toBe('')
  })
  expect(onChange).not.toHaveBeenCalled()
})

test('selecting a value shrinks the label', async () => {
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
  fireEvent.focus(combobox)
  fireEvent.keyDown(combobox, { key: 'ArrowDown' })
  fireEvent.click(getByRole('option', { name: 'Human (GRCh38/hg38)' }))
  await waitFor(() => {
    expect(onChange).toHaveBeenCalledWith('hg38')
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
