import { LocationPicker } from './LocationPicker'
import type { Coordinates, DeliveryLocation } from '../../domain/delivery/locations'
import type { DeliveryLocationValue } from '../../domain/delivery/types'

interface EndpointLocationFieldProps {
  label: string
  location: DeliveryLocationValue | null
  fallback: DeliveryLocation
  onChange: (location: DeliveryLocationValue) => void
}

export function EndpointLocationField({ label, location, fallback, onChange }: EndpointLocationFieldProps) {
  const center: Coordinates = location ? [location.longitude, location.latitude] : fallback.coordinates

  return <div className="endpoint-location-field">
    <label>{label}</label>
    <div className="endpoint-location-current"><strong>{location?.label ?? `Escolha ${label.toLowerCase()}`}</strong></div>
    <LocationPicker center={center} location={location ?? undefined} onChange={(value) => { if (value.latitude !== undefined && value.longitude !== undefined) onChange({ label: value.label, latitude: value.latitude, longitude: value.longitude }) }} onClear={() => onChange({ label: fallback.label, latitude: fallback.coordinates[1], longitude: fallback.coordinates[0] })} />
  </div>
}
