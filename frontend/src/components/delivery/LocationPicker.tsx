import { useEffect, useRef, useState } from 'react'
import { Map, Marker, NavigationControl, setWorkerUrl } from 'maplibre-gl'
import mapWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import type { Coordinates } from '../../domain/delivery/locations'
import type { CreateDeliveryStep } from '../../domain/delivery/types'
import 'maplibre-gl/dist/maplibre-gl.css'

setWorkerUrl(mapWorkerUrl)

const mapStyle = 'https://tiles.openfreemap.org/styles/liberty'

interface LocationPickerProps {
  center: Coordinates
  location?: CreateDeliveryStep['location']
  onChange: (location: NonNullable<CreateDeliveryStep['location']>) => void
  onClear: () => void
}

export function LocationPicker({ center, location, onChange, onClear }: LocationPickerProps) {
  const [open, setOpen] = useState(Boolean(location))
  const [mapError, setMapError] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const markerRef = useRef<Marker | null>(null)
  const locationRef = useRef(location)

  useEffect(() => {
    locationRef.current = location
    if (location) setOpen(true)
    const marker = markerRef.current
    if (!marker || location?.latitude === undefined || location.longitude === undefined) return
    marker.setLngLat([location.longitude, location.latitude])
  }, [location])

  useEffect(() => {
    if (!open || !containerRef.current) return

    let map: Map
    try {
      map = new Map({
        container: containerRef.current,
        style: mapStyle,
        center: location?.longitude !== undefined && location.latitude !== undefined ? [location.longitude, location.latitude] : center,
        zoom: location ? 8 : 2,
        attributionControl: { compact: true },
      })
      map.addControl(new NavigationControl({ showCompass: false }), 'top-right')
      map.on('error', () => setMapError(true))

      map.once('load', () => {
        map.resize()
        window.requestAnimationFrame(() => map.resize())
        const current = locationRef.current
        if (current?.longitude !== undefined && current.latitude !== undefined) {
          markerRef.current = new Marker({ color: '#d96d5e' }).setLngLat([current.longitude, current.latitude]).addTo(map)
        }
      })
      map.on('click', (event) => {
        const coordinates: Coordinates = [event.lngLat.lng, event.lngLat.lat]
        markerRef.current?.remove()
        markerRef.current = new Marker({ color: '#d96d5e' }).setLngLat(coordinates).addTo(map)
        onChange({
          label: locationRef.current?.label || 'Ponto escolhido no mapa',
          longitude: coordinates[0],
          latitude: coordinates[1],
        })
      })
    } catch {
      setMapError(true)
      return
    }
    return () => {
      markerRef.current?.remove()
      markerRef.current = null
      map.remove()
    }
  }, [open])

  if (!open) return <button type="button" className="location-picker-trigger" onClick={() => setOpen(true)}>＋ escolher localização no mapa</button>

  return <div className="location-picker">
    <div ref={containerRef} className="location-picker-map" aria-label="Mapa para escolher a localização da etapa" />
    {mapError && <p className="location-picker-error" role="status">Não foi possível carregar o mapa. Tente novamente ou informe as coordenadas manualmente.</p>}
    <div className="location-picker-fields">
      <input aria-label="Nome da localização" value={location?.label ?? ''} placeholder="Nome do lugar ou momento" onChange={(event) => onChange({ label: event.target.value, latitude: location?.latitude, longitude: location?.longitude })} />
      {location && <button type="button" className="text-button" onClick={() => { setOpen(false); onClear() }}>remover localização</button>}
    </div>
    {location?.latitude !== undefined && location.longitude !== undefined && <small className="location-picker-coordinates">{location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}</small>}
  </div>
}
