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

export function createDeliveryShareUrl(
  baseUrl: string,
  publicId: string,
  token: string,
  role: 'sender' | 'recipient',
): string | null {
  try {
    const url = new URL(baseUrl)
    if (!['http:', 'https:'].includes(url.protocol)) return null
    return `${url.origin}${deliveryPath(publicId, token, role)}`
  } catch {
    return null
  }
}

export function previewDeliveryShareUrl(url: string) {
  const parsed = new URL(url)
  const publicId = parsed.pathname.split('/').pop() ?? ''
  const shortId = publicId.length > 8 ? `${publicId.slice(0, 8)}…` : publicId

  return `${parsed.host}/d/${shortId}`
}
