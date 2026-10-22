export type DeliveryStatus = 'SCHEDULED' | 'IN_TRANSIT' | 'DELIVERED'

export interface Delivery {
  public_id: string
  sender_name: string | null
  recipient_name: string
  origin: string
  destination: string
  courier: string
  starts_at: string
  arrives_at: string
  status: DeliveryStatus
  progress: number
}

export interface CreateDeliveryInput {
  message: string
  sender_name?: string
  recipient_name: string
  origin: string
  destination: string
  duration_minutes: number
}

export interface CreateDeliveryResponse {
  data: Delivery
  access_token: string
  tracking_path: string
}

export interface DeliveryMessage {
  public_id: string
  message: string
  delivered_at: string
}

export interface ApiErrorPayload {
  error?: { code?: string; message?: string }
  message?: string
  errors?: Record<string, string[]>
}
