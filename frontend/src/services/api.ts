import type {
  CreateDeliveryInput,
  CreateDeliveryResponse,
  Delivery,
  DeliveryMessage,
  ApiErrorPayload,
  AdminDeliverySummary,
} from '../domain/delivery/types'
import { resolveApiBaseUrl } from '../config/runtimeConfig.ts'

const apiBaseUrl = resolveApiBaseUrl(import.meta.env)
const authTokenStorageKey = 'cartopia.auth_token'

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
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(getAuthToken() ? { Authorization: `Bearer ${getAuthToken()}` } : {}),
      ...options.headers,
    },
  })

  const payload = (await response.json().catch(() => ({}))) as ApiErrorPayload & T

  if (!response.ok) {
    const retryAfter = Number(response.headers.get('Retry-After'))
    throw new ApiError(response.status, payload, Number.isFinite(retryAfter) ? retryAfter : undefined)
  }

  return payload as T
}

export interface AuthUser { id: number; name: string; email: string }
export interface SavedLocation { id: number; name: string; label: string; latitude: number; longitude: number }
export interface SavedRecipient { id: number; name: string; nickname: string | null }
export interface AccountDelivery { public_id: string; recipient_name: string; origin: string; destination: string; status: string; progress: number; starts_at: string; arrives_at: string }
export interface TrackedDelivery { id: number; public_id: string; label: string | null; role: 'sender' | 'recipient'; recipient_name: string; origin: string; destination: string; status: string; progress: number; arrives_at: string }

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
  ]).then(([user, deliveries, locations, recipients, trackedDeliveries]) => ({ ...user.data, deliveries: deliveries.data, locations: locations.data, recipients: recipients.data, trackedDeliveries: trackedDeliveries.data }))
}

export function fetchSavedItems() {
  return Promise.all([
    request<{ data: SavedLocation[] }>('/account/locations'),
    request<{ data: SavedRecipient[] }>('/account/recipients'),
  ]).then(([locations, recipients]) => ({ locations: locations.data, recipients: recipients.data }))
}

export function saveLocation(input: Omit<SavedLocation, 'id'>) {
  return request<{ data: SavedLocation }>('/account/locations', { method: 'POST', body: JSON.stringify(input) })
}

export function deleteLocation(id: number) {
  return request(`/account/locations/${id}`, { method: 'DELETE' })
}

export function saveRecipient(input: { name: string; nickname?: string }) {
  return request<{ data: SavedRecipient }>('/account/recipients', { method: 'POST', body: JSON.stringify(input) })
}

export function deleteRecipient(id: number) {
  return request(`/account/recipients/${id}`, { method: 'DELETE' })
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
