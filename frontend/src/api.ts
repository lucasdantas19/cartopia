import type {
  CreateDeliveryInput,
  CreateDeliveryResponse,
  Delivery,
  DeliveryMessage,
  ApiErrorPayload,
} from './types'

const apiBaseUrl = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api').replace(/\/$/, '')

export class ApiError extends Error {
  status: number
  code?: string
  fields?: Record<string, string[]>

  constructor(status: number, payload: ApiErrorPayload) {
    super(payload.error?.message ?? payload.message ?? 'Não foi possível concluir a operação.')
    this.name = 'ApiError'
    this.status = status
    this.code = payload.error?.code
    this.fields = payload.errors
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
    throw new ApiError(response.status, payload)
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
