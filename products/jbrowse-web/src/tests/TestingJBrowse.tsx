import { MemoryRouter } from 'react-router-dom'

import JBrowse from '../components/JBrowse.tsx'

export default function TestingJBrowse(props: any) {
  return (
    <MemoryRouter initialEntries={['/workspace']}>
      <JBrowse {...props} />
    </MemoryRouter>
  )
}
