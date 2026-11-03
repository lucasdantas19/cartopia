import { apiUrl } from './config'
import type { AccountDelivery, Delivery, DeliveryLocation, DeliveryMessage, Session, User } from './domain'

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

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const headers = new Headers(options.headers)
  headers.set('Accept', 'application/json')
  if (options.body) headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)

  let response: Response

  try {
    response = await fetch(`${apiUrl}${path}`, { ...options, headers })
  } catch {
    throw new ApiError(
      `Não foi possível conectar à API em ${apiUrl}. No celular, use o IP da sua máquina na variável EXPO_PUBLIC_API_URL.`,
      0,
      'NETWORK_ERROR',
    )
  }
  const body = await response.json().catch(() => null)

  if (!response.ok) {
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

export function fetchDelivery(publicId: string, token: string) {
  return request<{ data: Delivery }>(`/deliveries/${encodeURIComponent(publicId)}`, {}, token)
}

export function fetchRecipientShareLink(publicId: string, senderToken: string) {
  return request<{ data: { public_id: string; recipient_access_token: string } }>(
    `/deliveries/${encodeURIComponent(publicId)}/recipient-share-link`,
    {},
    senderToken,
  )
}

export function openDeliveryMessage(publicId: string, token: string) {
  return request<{ data: DeliveryMessage }>(`/deliveries/${encodeURIComponent(publicId)}/message`, {}, token)
}

export function logout(token: string) {
  return request('/auth/logout', { method: 'POST' }, token)
}

export function fetchAccountDeliveries(token: string) {
  return request<{ data: AccountDelivery[] }>('/account/deliveries', {}, token)
}

export function fetchIncomingDeliveries(token: string) {
  return request<{ data: AccountDelivery[] }>('/account/incoming-deliveries', {}, token)
}

export function fetchIncomingDeliveryToken(publicId: string, token: string) {
  return request<{ data: { public_id: string; role: 'recipient'; access_token: string } }>(
    `/account/incoming-deliveries/${encodeURIComponent(publicId)}/token`,
    {},
    token,
  )
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
  }, token)
}
