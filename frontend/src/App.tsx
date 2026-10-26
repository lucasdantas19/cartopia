import { useEffect, useState } from 'react'
import { CreatePage } from './pages/CreatePage'
import { PrivacyPageShell } from './pages/PrivacyPageShell'
import { TrackingPage } from './pages/TrackingPage'
import './App.css'

type Route = { page: 'create' } | { page: 'tracking'; publicId: string } | { page: 'privacy' }

function routeFromLocation(): Route {
  const match = window.location.pathname.match(/^\/d\/([^/]+)$/)
  if (window.location.pathname === '/privacidade') return { page: 'privacy' }
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

  if (route.page === 'tracking') return <TrackingPage publicId={route.publicId} onHome={onHome} onPrivacy={onPrivacy} />
  if (route.page === 'privacy') return <PrivacyPageShell onHome={onHome} onPrivacy={onPrivacy} />
  return <CreatePage onTrack={(publicId, token) => navigate(`/d/${publicId}#token=${encodeURIComponent(token)}`)} onHome={onHome} onPrivacy={onPrivacy} />
}

export default App
