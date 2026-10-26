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
  openByDefault?: boolean
}

interface MapboxFeature {
  id?: string
  properties?: { name?: string; full_address?: string; place_formatted?: string }
  text?: string
  place_name?: string
  geometry?: { coordinates?: [number, number] }
}

export function LocationPicker({ center, location, onChange, onClear, openByDefault = false }: LocationPickerProps) {
  const [open, setOpen] = useState(Boolean(location) && openByDefault)
  const [mapError, setMapError] = useState(false)
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<MapboxFeature[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<Map | null>(null)
  const markerRef = useRef<Marker | null>(null)
  const locationRef = useRef(location)

  useEffect(() => {
    locationRef.current = location
    if (location && openByDefault) setOpen(true)
    const marker = markerRef.current
    if (!marker || location?.latitude === undefined || location.longitude === undefined) return
    marker.setLngLat([location.longitude, location.latitude])
  }, [location, openByDefault])

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
    mapRef.current = map
    return () => {
      markerRef.current?.remove()
      markerRef.current = null
      map.remove()
      mapRef.current = null
    }
  }, [open])

  async function searchPlaces() {
    const query = search.trim().replaceAll(';', '')
    const token = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN?.trim()
    if (!token) {
      setSearchError('Configure VITE_MAPBOX_ACCESS_TOKEN para pesquisar lugares.')
      return
    }
    if (query.length < 3) {
      setSearchError('Digite pelo menos 3 caracteres para pesquisar.')
      return
    }

    setSearching(true)
    setSearchError('')
    setResults([])
    try {
      const params = new URLSearchParams({ q: query, access_token: token, autocomplete: 'false', limit: '5', language: 'pt' })
      const response = await fetch(`https://api.mapbox.com/search/geocode/v6/forward?${params}`)
      if (!response.ok) throw new Error('Mapbox search failed')
      const payload = await response.json() as { features?: MapboxFeature[] }
      setResults(payload.features ?? [])
      if (!payload.features?.length) setSearchError('Nenhum lugar encontrado.')
    } catch {
      setSearchError('Não foi possível pesquisar esse lugar agora.')
    } finally {
      setSearching(false)
    }
  }

  function selectSearchResult(feature: MapboxFeature) {
    const coordinates = feature.geometry?.coordinates
    if (!coordinates) return
    const label = feature.properties?.full_address || feature.properties?.name || feature.place_name || feature.text || 'Lugar escolhido'
    locationRef.current = { label, longitude: coordinates[0], latitude: coordinates[1] }
    markerRef.current?.remove()
    const map = mapRef.current
    if (map) {
      markerRef.current = new Marker({ color: '#d96d5e' }).setLngLat(coordinates).addTo(map)
      map.flyTo({ center: coordinates, zoom: 12, duration: 500 })
    }
    onChange(locationRef.current)
    setSearch(label)
    setResults([])
  }

  if (!open) return <button type="button" className="location-picker-trigger" onClick={() => setOpen(true)}>＋ escolher localização no mapa</button>

  return <div className="location-picker">
    <div className="location-search" role="search">
      <label htmlFor="location-search">Pesquisar lugar ou endereço</label>
      <div className="location-search-row"><input id="location-search" value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void searchPlaces() } }} placeholder="Ex.: Keukenhof, Paris" /><button type="button" className="button secondary" onClick={() => { void searchPlaces() }} disabled={searching}>{searching ? 'Buscando…' : 'Buscar'}</button></div>
      {results.length > 0 && <div className="location-search-results" role="listbox" aria-label="Resultados da busca">{results.map((result, index) => <button type="button" role="option" key={result.id ?? index} onClick={() => selectSearchResult(result)}>{result.properties?.full_address || result.properties?.name || result.place_name || result.text}</button>)}</div>}
      {searchError && <small className="location-picker-error" role="status">{searchError}</small>}
    </div>
    <div ref={containerRef} className="location-picker-map" aria-label="Mapa para escolher a localização da etapa" />
    {mapError && <p className="location-picker-error" role="status">Não foi possível carregar o mapa. Tente novamente ou informe as coordenadas manualmente.</p>}
    <div className="location-picker-fields">
      <input aria-label="Nome da localização" value={location?.label ?? ''} placeholder="Nome do lugar ou momento" onChange={(event) => onChange({ label: event.target.value, latitude: location?.latitude, longitude: location?.longitude })} />
      {location && <button type="button" className="text-button" onClick={() => { setOpen(false); onClear() }}>remover localização</button>}
    </div>
  </div>
}
