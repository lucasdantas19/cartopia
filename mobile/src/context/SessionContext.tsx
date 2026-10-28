import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react'
import { login, logout, register } from '../api'
import { clearSession, readSession, saveSession } from '../session'
import type { Session } from '../domain'

type SessionContextValue = {
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (name: string, email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const SessionContext = createContext<SessionContextValue | null>(null)

export function SessionProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    readSession().then(setSession).finally(() => setLoading(false))
  }, [])

  const value = useMemo<SessionContextValue>(() => ({
    session,
    loading,
    async signIn(email, password) {
      const next = await login(email, password)
      await saveSession(next)
      setSession(next)
    },
    async signUp(name, email, password) {
      const next = await register(name, email, password)
      await saveSession(next)
      setSession(next)
    },
    async signOut() {
      if (session) await logout(session.token).catch(() => undefined)
      await clearSession()
      setSession(null)
    },
  }), [loading, session])

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession() {
  const value = useContext(SessionContext)
  if (!value) throw new Error('useSession must be used inside SessionProvider')
  return value
}
