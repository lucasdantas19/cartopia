export type DeliveryLink = {
  publicId: string
  token: string
  role: 'sender' | 'recipient'
}

export function parseDeliveryLink(url: string): DeliveryLink | null {
  let parsed: URL

  try {
    parsed = new URL(url)
  } catch {
    return null
  }

  const match = parsed.pathname.match(/\/d\/([^/]+)$/)
  const token = parsed.hash.match(/(?:^|[&#])token=([^&]+)/)?.[1]

  if (!match || !token) return null

  return {
    publicId: decodeURIComponent(match[1]),
    token: decodeURIComponent(token),
    role: parsed.hash.includes('role=sender') ? 'sender' : 'recipient',
  }
}

export function deliveryPath(publicId: string, token: string, role: 'sender' | 'recipient' = 'recipient') {
  const roleQuery = role === 'sender' ? '&role=sender' : ''
  return `/d/${encodeURIComponent(publicId)}#token=${encodeURIComponent(token)}${roleQuery}`
}
