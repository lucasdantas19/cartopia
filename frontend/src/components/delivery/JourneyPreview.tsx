import { useEffect, useRef } from 'react'
import { LngLatBounds, Map, Marker, setWorkerUrl } from 'maplibre-gl'
import type { GeoJSONSource } from 'maplibre-gl'
import mapWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import type { Coordinates } from '../../domain/delivery/locations'
import type { CreateDeliveryStep, DeliveryLocationValue } from '../../domain/delivery/types'
import 'maplibre-gl/dist/maplibre-gl.css'

setWorkerUrl(mapWorkerUrl)

const mapStyle = 'https://tiles.openfreemap.org/styles/liberty'

interface JourneyPreviewProps {
  origin: DeliveryLocationValue
  destination: DeliveryLocationValue
  steps: CreateDeliveryStep[]
  finalDurationMinutes: number
}

interface PreviewPoint {
  label: string
  coordinates: Coordinates
  kind: 'origin' | 'stop' | 'destination'
}

function customPoint(step: CreateDeliveryStep, index: number): PreviewPoint | null {
  if (step.location?.latitude === undefined || step.location.longitude === undefined) return null
  return {
    label: step.location.label || `Parada ${index + 1}`,
    coordinates: [step.location.longitude, step.location.latitude],
    kind: 'stop',
  }
}

function createMarkerElement(point: PreviewPoint): HTMLDivElement {
  const element = document.createElement('div')
  element.className = `journey-preview-marker ${point.kind}`
  element.setAttribute('role', 'img')
  element.setAttribute('aria-label', point.label)
  return element
}

export function JourneyPreview({ origin, destination, steps, finalDurationMinutes }: JourneyPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<Map | null>(null)
  const markersRef = useRef<Marker[]>([])
  const points: PreviewPoint[] = [
    { label: origin.label, coordinates: [origin.longitude, origin.latitude] as Coordinates, kind: 'origin' },
    ...steps.map(customPoint).filter((point): point is PreviewPoint => Boolean(point)),
    { label: destination.label, coordinates: [destination.longitude, destination.latitude] as Coordinates, kind: 'destination' },
  ]

  useEffect(() => {
    if (!containerRef.current) return
    const map = new Map({ container: containerRef.current, style: mapStyle, center: points[0]?.coordinates ?? [0, 0], zoom: 2, attributionControl: { compact: true } })
    mapRef.current = map
    map.once('load', () => drawPreview(map, points, markersRef))
    return () => {
      markersRef.current.forEach((marker) => marker.remove())
      markersRef.current = []
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (map?.isStyleLoaded()) drawPreview(map, points, markersRef)
  }, [origin, destination, steps, finalDurationMinutes])

  return <section className="journey-preview" aria-label="Prévia da aventura">
    <div className="journey-preview-heading"><div><h3>Prévia da sua aventura</h3><p>Veja a ordem dos momentos antes de selar a entrega.</p></div><strong>{steps.reduce((total, step) => total + Number(step.duration_minutes || 0), Number(finalDurationMinutes || 0))} min</strong></div>
    <div className="journey-preview-timeline"><div className="journey-preview-event origin"><span className="journey-preview-dot" /><div><small>Partida</small><strong>{origin.label}</strong></div></div>{steps.map((step, index) => <div className="journey-preview-event" key={index}><span className="journey-preview-dot" /><div><small>{step.duration_minutes || 0} min desde o ponto anterior</small><strong>{step.title || `Parada ${index + 1}`}</strong>{step.location?.label && <em>{step.location.label}</em>}</div></div>)}<div className="journey-preview-event destination"><span className="journey-preview-dot" /><div><small>{finalDurationMinutes || 0} min desde a última parada</small><strong>{destination.label}</strong></div></div></div>
    <div ref={containerRef} className="journey-preview-map" aria-label="Mapa da prévia da aventura" />
    {points.length < 2 && <p className="journey-preview-note">Adicione uma localização para visualizar o percurso no mapa.</p>}
  </section>
}

function drawPreview(map: Map, points: PreviewPoint[], markersRef: { current: Marker[] }) {
  const sourceId = 'cartopia-journey-preview'
  const layerId = 'cartopia-journey-preview-line'
  const coordinates = points.map((point) => point.coordinates)
  const sourceData = { type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates } }
  const source = map.getSource(sourceId)
  if (source?.type === 'geojson') (source as GeoJSONSource).setData(sourceData)
  else if (!map.getSource(sourceId)) {
    map.addSource(sourceId, { type: 'geojson', data: sourceData })
    map.addLayer({ id: layerId, type: 'line', source: sourceId, paint: { 'line-color': '#d96d5e', 'line-width': 3, 'line-dasharray': [2, 2] } })
  }
  markersRef.current.forEach((marker) => marker.remove())
  markersRef.current = points.map((point) => new Marker({ element: createMarkerElement(point) }).setLngLat(point.coordinates).addTo(map))
  if (coordinates.length > 1) {
    const bounds = coordinates.reduce((bounds, coordinate) => bounds.extend(coordinate), new LngLatBounds(coordinates[0], coordinates[0]))
    map.fitBounds(bounds, { padding: 48, maxZoom: 10, duration: 0 })
  }
}
