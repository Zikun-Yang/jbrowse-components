import { useEffect, useState } from 'react'

import { readConfObject } from '../configuration/index.ts'

import type { AbstractSessionModel } from '../util/index.ts'

export function useSpeciesFilteredAssembly(
  session: AbstractSessionModel,
  initial?: string,
) {
  const { assemblyNames, assemblies } = session
  const [selectedSpecies, setSelectedSpecies] = useState('')
  const [selectedAsm, setSelectedAsm] = useState(
    initial || assemblyNames[0] || '',
  )

  const getSpecies = (name: string) => {
    const assembly = assemblies.find(
      asm => (readConfObject(asm, 'name') as string) === name,
    )
    return assembly ? (readConfObject(assembly, 'species') as string) || '' : ''
  }

  useEffect(() => {
    if (selectedSpecies && getSpecies(selectedAsm) !== selectedSpecies) {
      const first = assemblyNames.find(
        name => getSpecies(name) === selectedSpecies,
      )
      const next = first || ''
      if (next !== selectedAsm) {
        setSelectedAsm(next)
      }
    }
  }, [selectedSpecies, selectedAsm, assemblyNames, assemblies])

  return {
    selectedSpecies,
    setSelectedSpecies,
    selectedAsm,
    setSelectedAsm,
  }
}
