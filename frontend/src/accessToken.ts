export interface TokenStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export type AccessRole = 'sender' | 'recipient'

export function tokenStorageKey(publicId: string, role: AccessRole = 'recipient'): string {
  return 'cartopia.delivery_token.' + publicId + '.' + role
}

export function activeRoleStorageKey(publicId: string): string {
  return 'cartopia.delivery_access_role.' + publicId
}

export function createShareUrl(origin: string, publicId: string, token: string, role: AccessRole = 'recipient'): string {
  const fragment = role === 'sender'
    ? 'token=' + encodeURIComponent(token) + '&role=sender'
    : 'token=' + encodeURIComponent(token)

  return origin.replace(/\/$/, '') + '/d/' + encodeURIComponent(publicId) + '#' + fragment
}

export function extractTokenFromFragment(hash: string): string | null {
  const token = new URLSearchParams(hash.replace(/^#/, '')).get('token')

  return token || null
}

export function accessRoleFromFragment(hash: string): AccessRole {
  return new URLSearchParams(hash.replace(/^#/, '')).get('role') === 'sender' ? 'sender' : 'recipient'
}

export function resolveAccessToken(publicId: string, hash: string, storage: TokenStorage): { token: string | null; role: AccessRole; fromFragment: boolean } {
  const fragmentToken = extractTokenFromFragment(hash)
  const fragmentRole = accessRoleFromFragment(hash)

  if (fragmentToken) {
    storage.setItem(tokenStorageKey(publicId, fragmentRole), fragmentToken)
    storage.setItem(activeRoleStorageKey(publicId), fragmentRole)
    return { token: fragmentToken, role: fragmentRole, fromFragment: true }
  }

  const storedRole = storage.getItem(activeRoleStorageKey(publicId))
  const role: AccessRole = storedRole === 'sender' || storedRole === 'recipient'
    ? storedRole
    : storage.getItem(tokenStorageKey(publicId, 'recipient')) !== null
      || storage.getItem('cartopia.delivery_token.' + publicId) !== null
      ? 'recipient'
      : storage.getItem(tokenStorageKey(publicId, 'sender')) !== null
        ? 'sender'
        : 'recipient'
  const storedToken = storage.getItem(tokenStorageKey(publicId, role))
    ?? (role === 'recipient' ? storage.getItem('cartopia.delivery_token.' + publicId) : null)

  return { token: storedToken, role, fromFragment: false }
}

export function removeAccessToken(publicId: string, storage: TokenStorage, role: AccessRole = 'recipient'): void {
  storage.removeItem(tokenStorageKey(publicId, role))
  if (role === 'recipient') storage.removeItem('cartopia.delivery_token.' + publicId)
  if (storage.getItem(activeRoleStorageKey(publicId)) === role) storage.removeItem(activeRoleStorageKey(publicId))
}
