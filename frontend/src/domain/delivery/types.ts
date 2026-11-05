// Contratos compartilhados do domínio de entregas.
export type DeliveryStatus = 'SCHEDULED' | 'IN_TRANSIT' | 'DELIVERED'
export type AccessRole = 'sender' | 'recipient'
export type CourierCode = 'paper-swallow' | 'postal-cat' | 'little-dragon'
export type RouteVisibility = 'full' | 'progressive'
export type DestinationSource = 'specific' | 'recipient_default' | 'contact_preference'
export type DeliveryMode = 'real' | 'playful'
export type UnlockType = 'none' | 'password' | 'hangman'
export interface DeliveryLocationValue {
  label: string
  latitude: number
  longitude: number
}

export interface DeliveryRouteLeg {
  origin: string
  destination: string
  starts_at: string
  arrives_at: string
}

export interface DeliveryStep {
  title: string
  description: string | null
  location: { label: string; latitude?: number; longitude?: number } | null
  starts_at: string
  arrives_at: string
}

export interface CreateDeliveryLeg {
  destination: string
  duration_minutes: number
}

export interface CreateDeliveryStep {
  id?: string
  title: string
  description?: string
  duration_minutes: number
  location?: { label: string; latitude?: number; longitude?: number }
}

export interface Delivery {
  public_id: string
  sender_name: string | null
  recipient_name: string
  delivery_mode?: DeliveryMode
  unlock_type?: UnlockType
  unlock_locked?: boolean
  recipient_email?: string
  origin: string
  origin_location: DeliveryLocationValue | null
  destination: string
  destination_location: DeliveryLocationValue | null
  destination_source?: DestinationSource
  route_legs: DeliveryRouteLeg[]
  steps: DeliveryStep[]
  route_visibility: RouteVisibility
  hidden_steps_count: number
  current_step: number | null
  courier: string
  starts_at: string
  arrives_at: string
  final_duration_minutes: number | null
  status: DeliveryStatus
  progress: number
  opened_at: string | null
  access_role: AccessRole
}

export interface CreateDeliveryInput {
  message: string
  sender_name?: string
  recipient_name: string
  recipient_email?: string
  delivery_mode: DeliveryMode
  unlock_type: UnlockType
  unlock_password?: string
  origin: string
  origin_location: DeliveryLocationValue | null
  destination: string
  destination_location: DeliveryLocationValue | null
  destination_source: DestinationSource
  duration_minutes: number
  final_duration_minutes: number
  legs?: CreateDeliveryLeg[]
  steps?: CreateDeliveryStep[]
  route_visibility: RouteVisibility
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

export interface AdminDeliverySummary {
  public_id: string
  recipient_name: string
  sender_name: string | null
  origin: string
  destination: string
  status: DeliveryStatus
  progress: number
  starts_at: string
  arrives_at: string
  steps_count: number
  route_visibility: RouteVisibility
  created_at: string
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
