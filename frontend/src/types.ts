export type DeliveryStatus = 'SCHEDULED' | 'IN_TRANSIT' | 'DELIVERED'
export type AccessRole = 'sender' | 'recipient'
export type CourierCode = 'paper-swallow' | 'postal-cat' | 'little-dragon'

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
  opened_at: string | null
  access_role: AccessRole
}

export interface CreateDeliveryInput {
  message: string
  sender_name?: string
  recipient_name: string
  origin: string
  destination: string
  duration_minutes: number
  courier: CourierCode
}

export interface CreateDeliveryResponse {
  data: Delivery
  access_token: string
  recipient_access_token: string
  sender_access_token: string
  tracking_path: string
  recipient_tracking_path: string
  sender_tracking_path: string
}

export interface DeliveryMessage {
  public_id: string
  message: string
  delivered_at: string
  opened_at: string | null
}

export interface ApiErrorPayload {
  error?: { code?: string; message?: string }
  message?: string
  errors?: Record<string, string[]>
}
