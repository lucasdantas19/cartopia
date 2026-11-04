export function shouldExpireAccountSession(
  status: number,
  path: string,
  requestToken: string | null,
  currentToken: string | null,
): boolean {
  return status === 401 &&
    requestToken !== null &&
    requestToken === currentToken &&
    (path === '/auth/me' || path.startsWith('/account/'))
}
