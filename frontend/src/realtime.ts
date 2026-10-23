import Echo from 'laravel-echo'
import Pusher from 'pusher-js'
import type { AccessRole } from './types'
import { FrontendConfigurationError, isProductionEnvironment, resolveApiBaseUrl, validatePublicUrl } from './runtimeConfig.ts'

export type RealtimeStatus = 'connecting' | 'connected' | 'received' | 'unavailable'

type RealtimeEnvironment = {
  PROD?: boolean
  VITE_REVERB_ENABLED?: string
  VITE_REVERB_APP_KEY?: string
  VITE_REVERB_HOST?: string
  VITE_REVERB_PORT?: string
  VITE_REVERB_SCHEME?: string
  VITE_BROADCAST_AUTH_URL?: string
  VITE_API_URL?: string
}

export function realtimeConfiguration(env: RealtimeEnvironment = import.meta.env as RealtimeEnvironment) {
  const production = isProductionEnvironment(env)
  if (env.VITE_REVERB_ENABLED === 'false') return null
  if (!env.VITE_REVERB_APP_KEY) {
    if (production) throw new FrontendConfigurationError('VITE_REVERB_APP_KEY', 'é obrigatória quando o Reverb está habilitado')
    return null
  }

  const scheme = env.VITE_REVERB_SCHEME?.trim() ?? 'http'
  const host = env.VITE_REVERB_HOST?.trim() ?? (typeof window === 'undefined' ? 'localhost' : window.location.hostname)
  const port = Number(env.VITE_REVERB_PORT ?? 8080)
  const apiUrl = resolveApiBaseUrl(env)
  const authEndpoint = env.VITE_BROADCAST_AUTH_URL?.trim() ?? apiUrl + '/broadcasting/auth'

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    if (production) throw new FrontendConfigurationError('VITE_REVERB_PORT', 'deve ser uma porta válida')
  }

  if (production) {
    if (scheme !== 'https') throw new FrontendConfigurationError('VITE_REVERB_SCHEME', 'deve ser https')
    if (!host || ['localhost', '127.0.0.1', '::1'].includes(host)) throw new FrontendConfigurationError('VITE_REVERB_HOST', 'deve ser um host público')
    validatePublicUrl(authEndpoint, 'VITE_BROADCAST_AUTH_URL', true)
  }

  return {
    key: env.VITE_REVERB_APP_KEY,
    host,
    port,
    scheme,
    authEndpoint,
  }
}

export function deliveryChannelName(publicId: string, role: AccessRole = 'recipient'): string {
  return 'deliveries.' + publicId + (role === 'sender' ? '.sender' : '')
}

export function connectToDeliveryChannel(
  publicId: string,
  token: string,
  role: AccessRole,
  onStatus: (status: RealtimeStatus) => void,
  onMessageOpened: (openedAt: string) => void,
): (() => void) | null {
  const configuration = realtimeConfiguration()
  if (!configuration) return null

  onStatus('connecting')
  ;(window as unknown as Window & { Pusher: typeof Pusher }).Pusher = Pusher

  try {
    const echo = new Echo({
      broadcaster: 'reverb',
      key: configuration.key,
      wsHost: configuration.host,
      wsPort: configuration.port,
      wssPort: configuration.port,
      forceTLS: configuration.scheme === 'https',
      enabledTransports: ['ws', 'wss'],
      authEndpoint: configuration.authEndpoint,
      auth: {
        headers: {
          Accept: 'application/json',
          Authorization: 'Bearer ' + token,
        },
      },
    })

    const channel = echo.private(deliveryChannelName(publicId, role))
    channel
      .subscribed(() => onStatus('connected'))
      .error(() => onStatus('unavailable'))
      .listen('.delivery.message-opened', (event: { opened_at?: string }) => {
        if (event.opened_at) {
          onStatus('received')
          onMessageOpened(event.opened_at)
        }
      })
      .listen('.delivery.test', () => onStatus('received'))

    return () => {
      echo.leave(deliveryChannelName(publicId, role))
      echo.disconnect()
    }
  } catch {
    onStatus('unavailable')
    return null
  }
}
