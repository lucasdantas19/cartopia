import { getLocation } from '../../domain/delivery/locations'

interface LocationPreviewProps {
  code: string
  kind: 'origin' | 'destination'
}

export function LocationPreview({ code, kind }: LocationPreviewProps) {
  const location = getLocation(code)
  if (!location) return null

  return <div className={`location-preview ${kind}`} aria-live="polite">
    <span>{kind === 'origin' ? 'Ponto de partida' : 'Destino da aventura'}</span>
    <strong>{location.label}</strong>
    <p>{location.description}</p>
  </div>
}
