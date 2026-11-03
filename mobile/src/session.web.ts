import type { Session } from './domain'

const sessionKey = 'cartopia.session'

export async function readSession(): Promise<Session | null> {
  try {
    const value = window.sessionStorage.getItem(sessionKey)
    if (!value) return null

    return JSON.parse(value) as Session
  } catch {
    await clearSession()
    return null
  }
}

export async function saveSession(session: Session) {
  window.sessionStorage.setItem(sessionKey, JSON.stringify(session))
}

export async function clearSession() {
  try {
    window.sessionStorage.removeItem(sessionKey)
  } catch {
    // Browsers can block storage; the in-memory session still ends.
  }
}
