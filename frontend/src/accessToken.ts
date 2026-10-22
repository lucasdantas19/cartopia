export interface TokenStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export type AccessRole = 'sender' | 'recipient'

export function tokenStorageKey(publicId: string, role: AccessRole = 'recipient'): string {
  return 'cartopia.delivery_token.' + publicId + '.' + role
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
  const role = accessRoleFromFragment(hash)

  if (fragmentToken) {
    storage.setItem(tokenStorageKey(publicId, role), fragmentToken)
    return { token: fragmentToken, role, fromFragment: true }
  }

  const storedToken = storage.getItem(tokenStorageKey(publicId, role))
    ?? (role === 'recipient' ? storage.getItem('cartopia.delivery_token.' + publicId) : null)

  return { token: storedToken, role, fromFragment: false }
}

export function removeAccessToken(publicId: string, storage: TokenStorage, role: AccessRole = 'recipient'): void {
  storage.removeItem(tokenStorageKey(publicId, role))
  if (role === 'recipient') storage.removeItem('cartopia.delivery_token.' + publicId)
}
