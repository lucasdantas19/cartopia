export type User = {
  id: number
  name: string
  email: string
}

export type Session = {
  token: string
  user: User
}

export type Delivery = {
  public_id: string
  sender_name: string | null
  recipient_name: string
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
}

export type DeliveryLocation = {
  label: string
  latitude: number
  longitude: number
}
