import type {
  CreateDeliveryInput,
  CreateDeliveryResponse,
  Delivery,
  DeliveryMessage,
  ApiErrorPayload,
  AdminDeliverySummary,
} from '../domain/delivery/types'
import { resolveApiBaseUrl } from '../config/runtimeConfig.ts'
import { shouldExpireAccountSession } from './accountSession.ts'

const apiBaseUrl = resolveApiBaseUrl(import.meta.env)
const authTokenStorageKey = 'cartopia.auth_token'
export const accountSessionExpiredEvent = 'cartopia:account-session-expired'

export function getAuthToken(): string | null {
  return typeof window === 'undefined' ? null : window.localStorage.getItem(authTokenStorageKey)
}

export function setAuthToken(token: string | null) {
  if (typeof window === 'undefined') return
  if (token) window.localStorage.setItem(authTokenStorageKey, token)
  else window.localStorage.removeItem(authTokenStorageKey)
}

export class ApiError extends Error {
  status: number
  code?: string
  fields?: Record<string, string[]>
  retryAfter?: number

  constructor(status: number, payload: ApiErrorPayload, retryAfter?: number) {
    super(payload.error?.message ?? payload.message ?? 'Não foi possível concluir a operação.')
    this.name = 'ApiError'
    this.status = status
    this.code = payload.error?.code
    this.fields = payload.errors
    this.retryAfter = retryAfter
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const accountToken = getAuthToken()
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(accountToken ? { Authorization: `Bearer ${accountToken}` } : {}),
      ...options.headers,
    },
  })

  const payload = (await response.json().catch(() => ({}))) as ApiErrorPayload & T

  if (!response.ok) {
    if (shouldExpireAccountSession(response.status, path, accountToken, getAuthToken())) {
      setAuthToken(null)
      window.dispatchEvent(new Event(accountSessionExpiredEvent))
    }
    const retryAfter = Number(response.headers.get('Retry-After'))
    throw new ApiError(response.status, payload, Number.isFinite(retryAfter) ? retryAfter : undefined)
  }

  return payload as T
}

export interface AuthUser { id: number; name: string; email: string }
export interface DeliverySettings { allow_contact_delivery: boolean }
export interface DeliveryPreference { id: number; sender: { id: number; name: string; email: string }; location: { id: number; name: string; label: string } }
export interface RecipientDeliveryOptions { available: boolean; recipient_name: string | null; recipient_default_available: boolean; contact_preference_available: boolean }
export interface SavedLocation { id: number; name: string; label: string; latitude: number; longitude: number; is_default: boolean }
export interface SavedRecipient { id: number; name: string; email: string | null; nickname: string | null }
export interface AccountDelivery { public_id: string; recipient_name: string; recipient_email: string | null; origin: string; destination: string; status: string; progress: number; starts_at: string; arrives_at: string }
export interface IncomingDelivery { public_id: string; sender_name: string | null; recipient_name: string; origin: string; destination: string; status: string; progress: number; arrives_at: string; opened_at: string | null }
export interface TrackedDelivery { id: number; public_id: string; label: string | null; role: 'sender' | 'recipient'; recipient_name: string; origin: string; destination: string; status: string; progress: number; arrives_at: string }
export interface ActiveMapDelivery {
  public_id: string
  recipient_name: string
  courier: string
  origin: string
  destination: string
  origin_location: { label: string; latitude: number; longitude: number } | null
  destination_location: { label: string; latitude: number; longitude: number } | null
  starts_at: string
  arrives_at: string
  status: 'IN_TRANSIT'
  progress: number
}

export function register(input: { name: string; email: string; password: string }) {
  return request<{ data: AuthUser; token: string }>('/auth/register', { method: 'POST', body: JSON.stringify(input) })
}

export function login(input: { email: string; password: string }) {
  return request<{ data: AuthUser; token: string }>('/auth/login', { method: 'POST', body: JSON.stringify(input) })
}

export function logout() {
  return request<{ data: { logged_out: boolean } }>('/auth/logout', { method: 'POST' })
}

export function fetchAccount() {
  return Promise.all([
    request<{ data: AuthUser }>('/auth/me'),
    request<{ data: AccountDelivery[] }>('/account/deliveries'),
    request<{ data: SavedLocation[] }>('/account/locations'),
    request<{ data: SavedRecipient[] }>('/account/recipients'),
    request<{ data: TrackedDelivery[] }>('/account/tracked-deliveries'),
    request<{ data: IncomingDelivery[] }>('/account/incoming-deliveries'),
    request<{ data: DeliverySettings }>('/account/delivery-settings'),
    request<{ data: DeliveryPreference[] }>('/account/delivery-preferences'),
  ]).then(([user, deliveries, locations, recipients, trackedDeliveries, incomingDeliveries, deliverySettings, deliveryPreferences]) => ({ ...user.data, deliveries: deliveries.data, locations: locations.data, recipients: recipients.data, trackedDeliveries: trackedDeliveries.data, incomingDeliveries: incomingDeliveries.data, deliverySettings: deliverySettings.data, deliveryPreferences: deliveryPreferences.data }))
}

export function fetchActiveMapDeliveries() {
  return request<{ data: ActiveMapDelivery[] }>('/account/active-map-deliveries')
}

export function fetchSavedItems() {
  return Promise.all([
    request<{ data: SavedLocation[] }>('/account/locations'),
    request<{ data: SavedRecipient[] }>('/account/recipients'),
  ]).then(([locations, recipients]) => ({ locations: locations.data, recipients: recipients.data }))
}

export function fetchRecipientDeliveryOptions(recipientEmail: string) {
  return request<{ data: RecipientDeliveryOptions }>('/account/recipient-delivery-options?recipient_email=' + encodeURIComponent(recipientEmail))
}

export function updateDeliverySettings(allowContactDelivery: boolean) {
  return request<{ data: DeliverySettings }>('/account/delivery-settings', {
    method: 'PUT',
    body: JSON.stringify({ allow_contact_delivery: allowContactDelivery }),
  })
}

export function saveDeliveryPreference(input: { sender_email: string; location_id: number }) {
  return request<{ data: DeliveryPreference }>('/account/delivery-preferences', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function deleteDeliveryPreference(id: number) {
  return request('/account/delivery-preferences/' + id, { method: 'DELETE' })
}

export function saveLocation(input: Omit<SavedLocation, 'id' | 'is_default'> & { is_default?: boolean }) {
  return request<{ data: SavedLocation }>('/account/locations', { method: 'POST', body: JSON.stringify(input) })
}

export function setDefaultLocation(id: number) {
  return request<{ data: SavedLocation }>(`/account/locations/${id}/default`, { method: 'PUT' })
}

export function deleteLocation(id: number) {
  return request(`/account/locations/${id}`, { method: 'DELETE' })
}

export function saveRecipient(input: { name: string; email?: string; nickname?: string }) {
  return request<{ data: SavedRecipient }>('/account/recipients', { method: 'POST', body: JSON.stringify(input) })
}

export function fetchIncomingDeliveryToken(publicId: string) {
  return request<{ data: { public_id: string; role: 'recipient'; access_token: string } }>(`/account/incoming-deliveries/${encodeURIComponent(publicId)}/token`)
}

export function deleteRecipient(id: number) {
  return request(`/account/recipients/${id}`, { method: 'DELETE' })
}

export function fetchSentDeliveryToken(publicId: string) {
  return request<{ data: { public_id: string; role: 'sender'; access_token: string } }>('/account/deliveries/' + encodeURIComponent(publicId) + '/token')
}

export function saveTrackedDelivery(input: { public_id: string; access_token: string; role: 'sender' | 'recipient'; label?: string }) {
  return request<{ data: { id: number; public_id: string; role: 'sender' | 'recipient' } }>('/account/tracked-deliveries', { method: 'POST', body: JSON.stringify(input) })
}

export function fetchTrackedDeliveryToken(id: number) {
  return request<{ data: { public_id: string; role: 'sender' | 'recipient'; access_token: string } }>(`/account/tracked-deliveries/${id}/token`)
}

export function deleteTrackedDelivery(id: number) {
  return request(`/account/tracked-deliveries/${id}`, { method: 'DELETE' })
}

export function createDelivery(input: CreateDeliveryInput) {
  return request<CreateDeliveryResponse>('/deliveries', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function fetchDelivery(publicId: string, token: string) {
  return request<{ data: Delivery }>(`/deliveries/${encodeURIComponent(publicId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
}

export function openDeliveryMessage(publicId: string, token: string) {
  return request<{ data: DeliveryMessage }>(`/deliveries/${encodeURIComponent(publicId)}/message`, {
    headers: { Authorization: `Bearer ${token}` },
  })
}

export function fetchDeliveryChallenge(publicId: string, token: string) {
  return request<{ data: { type: 'none' | 'password' | 'hangman'; solved: boolean; attempts_remaining: number; pattern?: string; guessed_letters?: string[]; wrong_letters?: string[] } }>(`/deliveries/${encodeURIComponent(publicId)}/challenge`, {
    headers: { Authorization: `Bearer ${token}` },
  })
}

export function submitDeliveryChallenge(publicId: string, token: string, answer: string) {
  return request<{ data: { solved: boolean; attempts_remaining: number; pattern?: string; guessed_letters?: string[]; wrong_letters?: string[] } }>(`/deliveries/${encodeURIComponent(publicId)}/challenge`, {
    method: 'POST',
    body: JSON.stringify({ answer }),
    headers: { Authorization: `Bearer ${token}` },
  })
}

export function resetDeliveryChallenge(publicId: string, token: string) {
  return request<{ data: { reset: boolean; attempts_remaining: number } }>(`/deliveries/${encodeURIComponent(publicId)}/challenge/reset`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
}

function adminHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` }
}

export function fetchAdminDeliveries(token: string, query = '', status = '', page = 1) {
  const params = new URLSearchParams()
  if (query.trim()) params.set('q', query.trim())
  if (status) params.set('status', status)
  params.set('page', String(page))
  return request<{ data: AdminDeliverySummary[]; meta: { total: number; per_page: number; current_page: number; last_page: number } }>(`/admin/deliveries?${params}`, { headers: adminHeaders(token) })
}

export function regenerateAdminLinks(publicId: string, token: string) {
  return request<{ data: { recipient_path: string; sender_path: string } }>(`/admin/deliveries/${encodeURIComponent(publicId)}/regenerate-links`, { method: 'POST', headers: adminHeaders(token) })
}

export function deleteAdminDelivery(publicId: string, token: string) {
  return request<{ data: { deleted: boolean } }>(`/admin/deliveries/${encodeURIComponent(publicId)}`, { method: 'DELETE', headers: adminHeaders(token) })
}
