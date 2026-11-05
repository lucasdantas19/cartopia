export type User = {
  id: number
  name: string
  email: string
  allow_contact_delivery?: boolean
}

export type DestinationSource = 'specific' | 'recipient_default' | 'contact_preference'
export type DeliveryMode = 'real' | 'playful'
export type UnlockType = 'none' | 'password' | 'hangman'
export type RouteVisibility = 'full' | 'progressive'

export type DeliveryStep = {
  title: string
  description: string | null
  duration_minutes: number
  location?: DeliveryLocation | null
  starts_at?: string
  arrives_at?: string
}

export type Session = {
  token: string
  user: User
}

export type Delivery = {
  public_id: string
  sender_name: string | null
  recipient_name: string
  delivery_mode?: DeliveryMode
  unlock_type?: UnlockType
  unlock_locked?: boolean
  origin: string
  origin_location?: DeliveryLocation | null
  destination: string
  destination_location?: DeliveryLocation | null
  starts_at: string | null
  arrives_at: string | null
  status: 'SCHEDULED' | 'IN_TRANSIT' | 'DELIVERED'
  progress: number
  current_step: number
  courier: string
  access_role: 'sender' | 'recipient' | null
  route_visibility?: RouteVisibility
  steps?: DeliveryStep[]
  hidden_steps_count?: number
  next_step_arrives_at?: string | null
}

export type DeliveryMessage = {
  public_id: string
  message: string
  delivered_at: string | null
  opened_at: string | null
}

export type AccountDelivery = {
  public_id: string
  sender_name?: string | null
  recipient_name: string
  origin: string
  destination: string
  status: 'SCHEDULED' | 'IN_TRANSIT' | 'DELIVERED'
  progress: number
  starts_at?: string | null
  arrives_at: string | null
  opened_at?: string | null
}

export type PaginationMeta = {
  total: number
  per_page: number
  current_page: number
  last_page: number
}

export type SavedLocation = {
  id: number
  name: string
  label: string
  latitude: number
  longitude: number
  is_default: boolean
}

export type SavedRecipient = {
  id: number
  name: string
  email: string | null
  nickname: string | null
}

export type TrackedDelivery = AccountDelivery & {
  id: number
  label: string | null
  role: 'sender' | 'recipient'
}

export type ActiveMapDelivery = Pick<Delivery,
  'public_id' | 'recipient_name' | 'origin' | 'destination' | 'origin_location' |
  'destination_location' | 'starts_at' | 'arrives_at' | 'status' | 'progress' | 'courier'
>

export type DeliveryLocation = {
  label: string
  latitude: number
  longitude: number
}
