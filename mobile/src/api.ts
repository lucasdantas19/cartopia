import { apiUrl } from './config'
import type { AccountDelivery, ActiveMapDelivery, Delivery, DeliveryLocation, DeliveryMessage, DestinationSource, Session, User } from './domain'

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string | null = null,
    readonly errors: Record<string, string[]> | null = null,
  ) {
    super(message)
  }
}

type SessionExpiredListener = (token: string) => void
const sessionExpiredListeners = new Set<SessionExpiredListener>()

export function onSessionExpired(listener: SessionExpiredListener) {
  sessionExpiredListeners.add(listener)
  return () => {
    sessionExpiredListeners.delete(listener)
  }
}

function sessionExpired(token: string) {
  sessionExpiredListeners.forEach((listener) => listener(token))
  return new ApiError('Sua sessão terminou. Entre novamente para continuar.', 401, 'UNAUTHENTICATED')
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string,
  accountSession = false,
): Promise<T> {
  const headers = new Headers(options.headers)
  headers.set('Accept', 'application/json')
  if (options.body) headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)

  let response: Response

  try {
    response = await fetch(`${apiUrl}${path}`, { ...options, headers })
  } catch {
    throw new ApiError(
      'Não foi possível conectar. Verifique sua internet e tente novamente.',
      0,
      'NETWORK_ERROR',
    )
  }
  const body = await response.json().catch(() => null)

  if (!response.ok) {
    if (accountSession && token && response.status === 401 && body?.error?.code === 'UNAUTHENTICATED') {
      throw sessionExpired(token)
    }

    throw new ApiError(
      body?.error?.message ?? body?.message ?? 'Não foi possível concluir a solicitação.',
      response.status,
      body?.error?.code ?? null,
      body?.errors ?? null,
    )
  }

  return body as T
}

export async function login(email: string, password: string): Promise<Session> {
  const response = await request<{ data: User; token: string }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  return { user: response.data, token: response.token }
}

export async function register(name: string, email: string, password: string): Promise<Session> {
  const response = await request<{ data: User; token: string }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  })
  return { user: response.data, token: response.token }
}

export function fetchDelivery(publicId: string, token: string, role?: 'sender' | 'recipient') {
  const query = role ? `?role=${role}` : ''
  const path = `/deliveries/${encodeURIComponent(publicId)}${query}`
  if (!role) return request<{ data: Delivery }>(path, {}, token)

  return request<{ data: Delivery }>(path, {}, token).catch(async (error: unknown) => {
    if (error instanceof ApiError && error.status === 404) {
      await checkAccountSession(token)
    }
    throw error
  })
}

async function checkAccountSession(token: string) {
  await request<{ data: User }>('/auth/me', {}, token, true)
}

export function fetchRecipientShareLink(publicId: string, senderToken: string, fromAccount = false) {
  return request<{ data: { public_id: string; recipient_access_token: string } }>(
    `/deliveries/${encodeURIComponent(publicId)}/recipient-share-link`,
    {},
    senderToken,
    false,
  ).catch(async (error: unknown) => {
    if (fromAccount && error instanceof ApiError && error.status === 404) {
      await checkAccountSession(senderToken)
    }
    throw error
  })
}

export function openDeliveryMessage(publicId: string, token: string, fromAccount = false) {
  return request<{ data: DeliveryMessage }>(
    `/deliveries/${encodeURIComponent(publicId)}/message`,
    {},
    token,
    false,
  ).catch(async (error: unknown) => {
    if (fromAccount && error instanceof ApiError && error.status === 404) {
      await checkAccountSession(token)
    }
    throw error
  })
}

export function logout(token: string) {
  return request('/auth/logout', { method: 'POST' }, token)
}

export function fetchAccountDeliveries(token: string) {
  return request<{ data: AccountDelivery[] }>('/account/deliveries', {}, token, true)
}

export function fetchActiveMapDeliveries(token: string) {
  return request<{ data: ActiveMapDelivery[] }>('/account/active-map-deliveries', {}, token, true)
}

export function fetchIncomingDeliveries(token: string) {
  return request<{ data: AccountDelivery[] }>('/account/incoming-deliveries', {}, token, true)
}

export function fetchIncomingDeliveryToken(publicId: string, token: string) {
  return request<{ data: { public_id: string; role: 'recipient'; access_token: string } }>(
    `/account/incoming-deliveries/${encodeURIComponent(publicId)}/token`,
    {},
    token,
    true,
  )
}

export type RecipientDeliveryOptions = {
  available: boolean
  recipient_name: string | null
  recipient_default_available: boolean
  contact_preference_available: boolean
}

export function fetchRecipientDeliveryOptions(email: string, token: string) {
  return request<{ data: RecipientDeliveryOptions }>(
    '/account/recipient-delivery-options?recipient_email=' + encodeURIComponent(email),
    {},
    token,
    true,
  )
}

export function fetchDeliverySettings(token: string) {
  return request<{ data: { allow_contact_delivery: boolean } }>('/account/delivery-settings', {}, token, true)
}

export function updateDeliverySettings(allowContactDelivery: boolean, token: string) {
  return request<{ data: { allow_contact_delivery: boolean } }>('/account/delivery-settings', {
    method: 'PUT',
    body: JSON.stringify({ allow_contact_delivery: allowContactDelivery }),
  }, token, true)
}

export type CreateDeliveryPayload = {
  message: string
  sender_name?: string
  recipient_name: string
  recipient_email?: string
  origin: string
  origin_location: DeliveryLocation
  destination: string
  destination_location: DeliveryLocation
  destination_source?: DestinationSource
  courier: string
  duration_minutes: number
}

export function createDelivery(payload: CreateDeliveryPayload, token?: string) {
  return request<{
    data: { public_id: string }
    recipient_access_token: string
    sender_access_token: string
  }>('/deliveries', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, token, Boolean(token))
}
