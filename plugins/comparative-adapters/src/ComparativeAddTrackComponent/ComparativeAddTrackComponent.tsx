import { useEffect, useState } from 'react'

import { AssemblySelector, SpeciesSelector } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

const ComparativeAddTrackComponent = observer(
  function ComparativeAddTrackComponent({ model }: any) {
    const session = getSession(model)
    const { assemblyNames, assemblyManager } = session
    const [r0, setR0] = useState(session.assemblies[0]?.name)
    const [r1, setR1] = useState(session.assemblies[0]?.name)
    const [species0, setSpecies0] = useState('')
    const [species1, setSpecies1] = useState('')

    useEffect(() => {
      const assembly = assemblyManager.get(r0!)
      if (species0 && assembly?.species !== species0) {
        const first = assemblyNames.find(
          name => assemblyManager.get(name)?.species === species0,
        )
        const next = first || ''
        if (next !== r0) {
          setR0(next)
        }
      }
    }, [species0, r0, assemblyNames, assemblyManager])

    useEffect(() => {
      const assembly = assemblyManager.get(r1!)
      if (species1 && assembly?.species !== species1) {
        const first = assemblyNames.find(
          name => assemblyManager.get(name)?.species === species1,
        )
        const next = first || ''
        if (next !== r1) {
          setR1(next)
        }
      }
    }, [species1, r1, assemblyNames, assemblyManager])

    useEffect(() => {
      model.setMixinData({
        adapter: {
          queryAssembly: r0,
          targetAssembly: r1,
        },
      })
    }, [model, r0, r1])
    return (
      <>
        <SpeciesSelector
          session={session}
          selected={species0}
          onChange={val => {
            setSpecies0(val)
          }}
        />
        <AssemblySelector
          session={session}
          label="Query assembly"
          helperText=""
          selected={r0}
          species={species0}
          onChange={asm => {
            setR0(asm)
          }}
          TextFieldProps={{
            fullWidth: true,
          }}
        />
        <SpeciesSelector
          session={session}
          selected={species1}
          onChange={val => {
            setSpecies1(val)
          }}
        />
        <AssemblySelector
          session={session}
          label="Target assembly"
          helperText=""
          selected={r1}
          species={species1}
          onChange={asm => {
            setR1(asm)
          }}
          TextFieldProps={{
            fullWidth: true,
          }}
        />
      </>
    )
  },
)

export default ComparativeAddTrackComponent
