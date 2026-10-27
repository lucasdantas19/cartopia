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
