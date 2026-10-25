import { useEffect, useRef } from 'react'

import { App } from '@jbrowse/app-core'
import { onSnapshot } from '@jbrowse/mobx-state-tree'
import { CssBaseline, ThemeProvider } from '@mui/material'
import { observer } from 'mobx-react'
import { useLocation, useNavigate } from 'react-router-dom'

import FileHandleRestoreBanner from './FileHandleRestoreBanner.tsx'
import SettingsCards from './SettingsCards.tsx'
import ShareButton from './ShareButton.tsx'
import { readQueryParams, setQueryParams } from '../useQueryParam.ts'

import type { WebSessionModel } from '../sessionModel/index.ts'
import type PluginManager from '@jbrowse/core/PluginManager'

type ActiveView = 'landing' | 'workspace' | 'recents' | 'settings'

function pathToView(pathname: string): ActiveView {
  switch (pathname) {
    case '/':
      return 'landing'
    case '/workspace':
      return 'workspace'
    case '/recents':
      return 'recents'
    case '/settings':
      return 'settings'
    default:
      return 'workspace'
  }
}

function viewToPath(view: ActiveView): string {
  return view === 'landing' ? '/' : `/${view}`
}

const JBrowse = observer(function JBrowse({
  pluginManager,
}: {
  pluginManager: PluginManager
}) {
  const {
    adminKey,
    adminServer,
    config: configPath,
  } = readQueryParams(['adminKey', 'adminServer', 'config'])
  const { rootModel } = pluginManager
  const { error, jbrowse, session: s } = rootModel!
  const session = s as WebSessionModel
  const { id, theme, activeView } = session
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const sessionRef = useRef(session)
  sessionRef.current = session

  useEffect(() => {
    const view = pathToView(pathname)
    const currentSession = sessionRef.current
    if (view !== currentSession.activeView) {
      currentSession.setActiveView(view)
    }
  }, [pathname])

  useEffect(() => {
    // Use the session ref so this effect always sees the current activeView,
    // avoiding stale closures that can cause URL/activeView ping-pong.
    const currentSession = sessionRef.current
    const target = viewToPath(currentSession.activeView)
    if (pathname !== target) {
      navigate(target, { replace: true })
    }
  }, [activeView, navigate, pathname])

  useEffect(() => {
    setQueryParams({ session: `local-${id}` })
    // @ts-expect-error
    window.JBrowseRootModel = rootModel
    // @ts-expect-error
    window.JBrowseSession = session
  }, [id, rootModel, session])

  useEffect(() => {
    return adminKey
      ? onSnapshot(jbrowse, async snapshot => {
          try {
            const response = await fetch(adminServer || '/updateConfig', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                adminKey,
                configPath,
                config: snapshot,
              }),
            })
            if (!response.ok) {
              const message = await response.text()
              throw new Error(`HTTP ${response.status} (${message})`)
            }
          } catch (e) {
            session.notify(`Admin server error: ${e}`)
          }
        })
      : undefined
  }, [jbrowse, session, adminKey, adminServer, configPath])

  if (error) {
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw error
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <FileHandleRestoreBanner />
      {/* key={id} forces React to remount App when session changes (e.g.
          duplicate session) preventing stale references to old session views */}
      <App
        key={id}
        // @ts-expect-error
        session={session}
        HeaderButtons={<ShareButton session={session} />}
        SettingsCards={<SettingsCards session={session} />}
      />
    </ThemeProvider>
  )
})

export default JBrowse
