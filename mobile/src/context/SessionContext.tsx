import { createContext, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react'
import { login, logout, onSessionExpired, register } from '../api'
import { clearSession, readSession, saveSession } from '../session'
import type { Session } from '../domain'

type SessionContextValue = {
  session: Session | null
  loading: boolean
  sessionExpired: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (name: string, email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const SessionContext = createContext<SessionContextValue | null>(null)

export function SessionProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [sessionExpired, setSessionExpired] = useState(false)
  const sessionToken = useRef<string | null>(null)
  const pendingClear = useRef<Promise<void>>(Promise.resolve())

  useEffect(() => {
    readSession()
      .then((saved) => {
        sessionToken.current = saved?.token ?? null
        setSession(saved)
      })
      .catch(() => setSession(null))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => onSessionExpired((token) => {
    if (sessionToken.current !== token) return

    sessionToken.current = null
    setSession(null)
    setSessionExpired(true)
    pendingClear.current = clearSession().catch(() => undefined)
  }), [])

  const value = useMemo<SessionContextValue>(() => ({
    session,
    loading,
    sessionExpired,
    async signIn(email, password) {
      const next = await login(email, password)
      await pendingClear.current
      await saveSession(next)
      sessionToken.current = next.token
      setSession(next)
      setSessionExpired(false)
    },
    async signUp(name, email, password) {
      const next = await register(name, email, password)
      await pendingClear.current
      await saveSession(next)
      sessionToken.current = next.token
      setSession(next)
      setSessionExpired(false)
    },
    async signOut() {
      if (session) await logout(session.token).catch(() => undefined)
      await clearSession()
      sessionToken.current = null
      setSession(null)
      setSessionExpired(false)
    },
  }), [loading, session, sessionExpired])

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession() {
  const value = useContext(SessionContext)
  if (!value) throw new Error('useSession must be used inside SessionProvider')
  return value
}
