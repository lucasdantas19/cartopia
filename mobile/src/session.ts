import * as SecureStore from 'expo-secure-store'
import type { Session } from './domain'

const sessionKey = 'cartopia.session'

export async function readSession(): Promise<Session | null> {
  const value = await SecureStore.getItemAsync(sessionKey)
  if (!value) return null

  try {
    return JSON.parse(value) as Session
  } catch {
    await clearSession()
    return null
  }
}

export function saveSession(session: Session) {
  return SecureStore.setItemAsync(sessionKey, JSON.stringify(session))
}

export function clearSession() {
  return SecureStore.deleteItemAsync(sessionKey)
}
