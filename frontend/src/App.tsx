import { accountSectionFromPath, type AccountSection } from './utils/accountNavigation'
import { lazy, Suspense, useEffect, useState } from 'react'
import { accountSessionExpiredEvent, getAuthToken } from './services/api'
import type { AccessRole } from './domain/delivery/types'
import './App.css'

const CreatePage = lazy(async () => ({ default: (await import('./pages/CreatePage')).CreatePage }))
const PrivacyPageShell = lazy(async () => ({ default: (await import('./pages/PrivacyPageShell')).PrivacyPageShell }))
const TrackingPage = lazy(async () => ({ default: (await import('./pages/TrackingPage')).TrackingPage }))
const AdminPage = lazy(async () => ({ default: (await import('./pages/AdminPage')).AdminPage }))
const AuthPage = lazy(async () => ({ default: (await import('./pages/AuthPage')).AuthPage }))
const AccountPage = lazy(async () => ({ default: (await import('./pages/AccountPage')).AccountPage }))
type Route = { page: 'create' } | { page: 'tracking'; publicId: string } | { page: 'privacy' } | { page: 'admin' } | { page: 'auth' } | { page: 'account'; section: AccountSection }

function routeFromLocation(): Route {
  const match = window.location.pathname.match(/^\/d\/([^/]+)$/)
  if (window.location.pathname === '/privacidade') return { page: 'privacy' }
  if (window.location.pathname === '/admin') return { page: 'admin' }
  if (window.location.pathname === '/entrar') return { page: 'auth' }
  const accountSection = accountSectionFromPath(window.location.pathname)
  if (accountSection) return { page: 'account', section: accountSection }
  return match ? { page: 'tracking', publicId: decodeURIComponent(match[1]) } : { page: 'create' }
}

function navigate(path: string) {
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

function redirectToLogin() {
  if (window.location.pathname === '/entrar') return
  window.history.replaceState({}, '', '/entrar')
  window.dispatchEvent(new PopStateEvent('popstate'))
}

function App() {
  const [route, setRoute] = useState<Route>(routeFromLocation)
  useEffect(() => {
    const onPopState = () => setRoute(routeFromLocation())
    const onSessionExpired = () => redirectToLogin()
    window.addEventListener('popstate', onPopState)
    window.addEventListener(accountSessionExpiredEvent, onSessionExpired)
    return () => {
      window.removeEventListener('popstate', onPopState)
      window.removeEventListener(accountSessionExpiredEvent, onSessionExpired)
    }
  }, [])
  useEffect(() => {
    if (route.page === 'account' && !getAuthToken()) redirectToLogin()
  }, [route])
  const onHome = () => navigate('/')
  const onPrivacy = () => navigate('/privacidade')
  const onAccount = () => navigate(getAuthToken() ? '/conta' : '/entrar')
  return (
    <Suspense fallback={<div className="app-loading" role="status">Carregando…</div>}>
      {route.page === 'tracking' && <TrackingPage
        publicId={route.publicId}
        onHome={onHome}
        onPrivacy={onPrivacy} />}
      {route.page === 'privacy' && <PrivacyPageShell onHome={onHome} onPrivacy={onPrivacy} />}
      {route.page === 'admin' && <AdminPage onHome={onHome} />}
      {route.page === 'auth' && <AuthPage
        onHome={onHome}
        onPrivacy={onPrivacy}
        onAuthenticated={() => navigate('/conta')} />}
      {route.page === 'account' && <AccountPage
        section={route.section}
        onNavigate={navigate}
        onHome={onHome}
        onPrivacy={onPrivacy}
        onLogout={() => navigate('/')}
        onTrack={(publicId, token, role, openMessage) => navigate(`/d/${publicId}${openMessage ? '?carta=1' : ''}#token=${encodeURIComponent(token)}${role === 'sender' ? '&role=sender' : ''}`)} />}
      {route.page === 'create' && <CreatePage
        onTrack={(publicId, token, role: AccessRole = 'recipient') => navigate(`/d/${publicId}#token=${encodeURIComponent(token)}${role === 'sender' ? '&role=sender' : ''}`)}
        onHome={onHome}
        onPrivacy={onPrivacy}
        onAccount={onAccount}
      />}
    </Suspense>
  )
}
export default App
