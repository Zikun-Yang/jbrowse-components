import { useEffect, useState } from 'react'

import {
  AssemblySelector,
  FileSelector,
  SpeciesSelector,
} from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

import type { FileLocation } from '@jbrowse/core/util'

const MCScanAddTrackComponent = observer(function MCScanAddTrackComponent({
  model,
}: any) {
  const session = getSession(model)
  const { assemblyNames, assemblyManager } = session
  const [r0, setR0] = useState(session.assemblies[0]?.name)
  const [r1, setR1] = useState(session.assemblies[0]?.name)
  const [species0, setSpecies0] = useState('')
  const [species1, setSpecies1] = useState('')
  const [bed1Location, setBed1Location] = useState<FileLocation>()
  const [bed2Location, setBed2Location] = useState<FileLocation>()

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
        assemblyNamees: [r0, r1],
        bed1Location,
        bed2Location,
      },
    })
  }, [model, bed1Location, bed2Location, r0, r1])
  return (
    <div style={{ marginTop: 20 }}>
      <Typography>
        JBrowse requires the two BED files that specify the genomic locations of
        the genes in the .anchors files
      </Typography>
      <SpeciesSelector
        session={session}
        selected={species0}
        onChange={val => {
          setSpecies0(val)
        }}
      />
      <AssemblySelector
        session={session}
        label="BED1 assembly"
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
        label="BED2 assembly"
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
      <FileSelector
        name="BED1"
        inline
        description=""
        location={bed1Location}
        setLocation={loc => {
          setBed1Location(loc)
        }}
      />
      <FileSelector
        name="BED2"
        inline
        description=""
        location={bed2Location}
        setLocation={loc => {
          setBed2Location(loc)
        }}
      />
    </div>
  )
})

export default MCScanAddTrackComponent
