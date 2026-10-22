export interface TokenStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export function tokenStorageKey(publicId: string): string {
  return `cartopia.delivery_token.${publicId}`
}

export function createShareUrl(origin: string, publicId: string, token: string): string {
  return `${origin.replace(/\/$/, '')}/d/${encodeURIComponent(publicId)}#token=${encodeURIComponent(token)}`
}

export function extractTokenFromFragment(hash: string): string | null {
  const token = new URLSearchParams(hash.replace(/^#/, '')).get('token')

  return token || null
}

export function resolveAccessToken(publicId: string, hash: string, storage: TokenStorage): { token: string | null; fromFragment: boolean } {
  const fragmentToken = extractTokenFromFragment(hash)

  if (fragmentToken) {
    storage.setItem(tokenStorageKey(publicId), fragmentToken)
    return { token: fragmentToken, fromFragment: true }
  }

  return { token: storage.getItem(tokenStorageKey(publicId)), fromFragment: false }
}

export function removeAccessToken(publicId: string, storage: TokenStorage): void {
  storage.removeItem(tokenStorageKey(publicId))
}
