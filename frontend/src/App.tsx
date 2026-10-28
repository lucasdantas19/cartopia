import { useEffect, useState } from 'react'
import { CreatePage } from './pages/CreatePage'
import { PrivacyPageShell } from './pages/PrivacyPageShell'
import { TrackingPage } from './pages/TrackingPage'
import { AdminPage } from './pages/AdminPage'
import { AuthPage } from './pages/AuthPage'
import { AccountPage } from './pages/AccountPage'
import { getAuthToken } from './services/api'
import type { AccessRole } from './domain/delivery/types'
import './App.css'

type Route = { page: 'create' } | { page: 'tracking'; publicId: string } | { page: 'privacy' } | { page: 'admin' } | { page: 'auth' } | { page: 'account' }

function routeFromLocation(): Route {
  const match = window.location.pathname.match(/^\/d\/([^/]+)$/)
  if (window.location.pathname === '/privacidade') return { page: 'privacy' }
  if (window.location.pathname === '/admin') return { page: 'admin' }
  if (window.location.pathname === '/entrar') return { page: 'auth' }
  if (window.location.pathname === '/conta') return { page: 'account' }
  return match ? { page: 'tracking', publicId: decodeURIComponent(match[1]) } : { page: 'create' }
}

function navigate(path: string) {
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

function App() {
  const [route, setRoute] = useState<Route>(routeFromLocation)

  useEffect(() => {
    const onPopState = () => setRoute(routeFromLocation())
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const onHome = () => navigate('/')
  const onPrivacy = () => navigate('/privacidade')
  const onAccount = () => navigate(getAuthToken() ? '/conta' : '/entrar')

  if (route.page === 'tracking') {
    return <TrackingPage publicId={route.publicId} onHome={onHome} onPrivacy={onPrivacy} />
  }

  if (route.page === 'privacy') {
    return <PrivacyPageShell onHome={onHome} onPrivacy={onPrivacy} />
  }

  if (route.page === 'admin') {
    return <AdminPage onHome={onHome} />
  }

  if (route.page === 'auth') return <AuthPage onHome={onHome} onPrivacy={onPrivacy} onAuthenticated={() => navigate('/conta')} />
  if (route.page === 'account') return <AccountPage onHome={onHome} onPrivacy={onPrivacy} onLogout={() => navigate('/')} onTrack={(publicId, token, role) => navigate(`/d/${publicId}#token=${encodeURIComponent(token)}${role === 'sender' ? '&role=sender' : ''}`)} />

  return (
    <CreatePage
      onTrack={(publicId, token, role: AccessRole = 'recipient') => navigate(`/d/${publicId}#token=${encodeURIComponent(token)}${role === 'sender' ? '&role=sender' : ''}`)}
      onHome={onHome}
      onPrivacy={onPrivacy}
      onAccount={onAccount}
    />
  )
}

export default App
