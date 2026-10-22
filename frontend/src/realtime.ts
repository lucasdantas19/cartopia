import Echo from 'laravel-echo'
import Pusher from 'pusher-js'
import type { AccessRole } from './types'

export type RealtimeStatus = 'connecting' | 'connected' | 'received' | 'unavailable'

type RealtimeEnvironment = {
  VITE_REVERB_ENABLED?: string
  VITE_REVERB_APP_KEY?: string
  VITE_REVERB_HOST?: string
  VITE_REVERB_PORT?: string
  VITE_REVERB_SCHEME?: string
  VITE_BROADCAST_AUTH_URL?: string
  VITE_API_URL?: string
}

export function realtimeConfiguration(env: RealtimeEnvironment = import.meta.env as RealtimeEnvironment) {
  if (env.VITE_REVERB_ENABLED === 'false' || !env.VITE_REVERB_APP_KEY) return null

  const scheme = env.VITE_REVERB_SCHEME ?? 'http'
  const host = env.VITE_REVERB_HOST ?? (typeof window === 'undefined' ? 'localhost' : window.location.hostname)
  const port = Number(env.VITE_REVERB_PORT ?? 8080)
  const apiUrl = (env.VITE_API_URL ?? 'http://localhost:8000/api').replace(/\/$/, '')

  return {
    key: env.VITE_REVERB_APP_KEY,
    host,
    port,
    scheme,
    authEndpoint: env.VITE_BROADCAST_AUTH_URL ?? apiUrl + '/broadcasting/auth',
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
