import PluginManager from '@jbrowse/core/PluginManager'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import { types } from '@jbrowse/mobx-state-tree'
import { ThemeProvider } from '@mui/material'
import { render, screen, waitFor } from '@testing-library/react'

import AboutDialogContents from './AboutDialogContents.tsx'

const pluginManager = new PluginManager([]).createPluggableElements()
pluginManager.configure()

const SessionModel = types.model({
  configuration: types.frozen(),
  assemblyNames: types.array(types.string),
  assemblies: types.frozen(),
  rpcManager: types.frozen(),
})

function makeSession(configuration: Record<string, unknown> = {}) {
  return SessionModel.create(
    {
      configuration,
      assemblyNames: ['hg38'],
      assemblies: [],
      rpcManager: { call: async () => 'file info' },
    },
    { pluginManager },
  )
}

function makeConfig(formatAbout?: Record<string, unknown>) {
  return {
    trackId: 'tissue_expression',
    name: 'Tissue expression',
    type: 'FeatureTrack',
    assemblyNames: ['hg38'],
    metadata: { source: 'GEO' },
    adapter: { type: 'CramAdapter', uri: '/data/tissue.cram' },
    ...(formatAbout ? { formatAbout } : {}),
  }
}

function renderAbout(
  config: ReturnType<typeof makeConfig>,
  session = makeSession(),
) {
  return render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <AboutDialogContents config={config} session={session as any} />
    </ThemeProvider>,
  )
}

describe('AboutDialogContents track info', () => {
  test('renders markdown from formatAbout.info', async () => {
    const { container } = renderAbout(
      makeConfig({
        info: `**Bold** info

- first item
- second item

| field | value |
| --- | --- |
| source | GEO |

\`\`\`js
const a = 1
\`\`\`
`,
      }),
    )

    expect(await screen.findByText('Track info')).toBeTruthy()
    await waitFor(() => {
      expect(container.querySelector('strong')?.textContent).toBe('Bold')
    })
    expect(container.querySelectorAll('li')).toHaveLength(2)
    expect(container.querySelector('table')).toBeTruthy()
    expect(container.querySelector('pre code')?.textContent).toContain(
      'const a = 1',
    )
  })

  test('renders the track info card before the configuration card', async () => {
    const { container } = renderAbout(makeConfig({ info: 'some **info**' }))
    await screen.findByText('Track info')
    const titles = [
      ...container.querySelectorAll('.MuiAccordionSummary-content'),
    ].map(el => el.textContent)
    expect(titles[0]).toBe('Track info')
    expect(titles).toContain('Configuration')
  })

  test('does not render the card without info', () => {
    renderAbout(makeConfig())
    expect(screen.queryByText('Track info')).toBeNull()
  })

  test('falls back to the root info', async () => {
    const session = makeSession({ formatAbout: { info: 'site wide **info**' } })
    renderAbout(makeConfig(), session)
    expect(await screen.findByText('Track info')).toBeTruthy()
    expect(await screen.findByText('info')).toBeTruthy()
  })

  test('respects showInfo false on the track', () => {
    renderAbout(makeConfig({ info: 'hidden info', showInfo: false }))
    expect(screen.queryByText('Track info')).toBeNull()
  })

  test('respects showInfo false on the root config', () => {
    const session = makeSession({ formatAbout: { showInfo: false } })
    renderAbout(makeConfig({ info: 'hidden info' }), session)
    expect(screen.queryByText('Track info')).toBeNull()
  })

  test('renders dangerous markdown as inert content', async () => {
    const { container } = renderAbout(
      makeConfig({
        info: `[x](javascript:alert(1))

<img src=x onerror="window.__aboutXss = true">
`,
      }),
    )
    await screen.findByText('Track info')
    await waitFor(() => {
      expect(container.querySelector('img')).toBeNull()
    })
    expect(container.querySelector('[onerror]')).toBeNull()
    expect(container.querySelectorAll('a')).toHaveLength(0)
    // @ts-expect-error - test flag
    expect(window.__aboutXss).toBeUndefined()
  })
})
