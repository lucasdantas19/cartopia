import { LocationPicker } from './LocationPicker'
import type { Coordinates, DeliveryLocation } from '../../domain/delivery/locations'
import type { DeliveryLocationValue } from '../../domain/delivery/types'
import type { SavedLocation } from '../../services/api'

interface EndpointLocationFieldProps {
  label: string
  location: DeliveryLocationValue | null
  fallback: DeliveryLocation
  onChange: (location: DeliveryLocationValue) => void
  savedLocations: SavedLocation[]
  onSavedLocation: (location: SavedLocation) => void
}

export function EndpointLocationField({ label, location, fallback, onChange, savedLocations, onSavedLocation }: EndpointLocationFieldProps) {
  const center: Coordinates = location ? [location.longitude, location.latitude] : fallback.coordinates

  return <div className="endpoint-location-field">
    <label>{label}</label>
    <div className="endpoint-location-current"><strong>{location?.label ?? `Escolha ${label.toLowerCase()}`}</strong></div>
    {savedLocations.length > 0 && (
      <select className="saved-location-select" aria-label={`Usar lugar salvo como ${label.toLowerCase()}`} defaultValue="" onChange={(event) => {
        const saved = savedLocations.find((item) => String(item.id) === event.target.value)
        if (saved) onSavedLocation(saved)
        event.currentTarget.value = ''
      }}>
        <option value="">Usar lugar salvo…</option>
        {savedLocations.map((saved) => <option key={saved.id} value={saved.id}>{saved.name} · {saved.label}</option>)}
      </select>
    )}
    <LocationPicker center={center} location={location ?? undefined} clearLabel="restaurar local sugerido" onChange={(value) => { if (value.latitude !== undefined && value.longitude !== undefined) onChange({ label: value.label, latitude: value.latitude, longitude: value.longitude }) }} onClear={() => onChange({ label: fallback.label, latitude: fallback.coordinates[1], longitude: fallback.coordinates[0] })} />
  </div>
}
