import { useCallback, useEffect, useRef, useState } from 'react'
import { AttributionControl, LngLatBounds, Map, Marker, NavigationControl, setWorkerUrl } from 'maplibre-gl'
import mapWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import type { GeoJSONSource } from 'maplibre-gl'
import { createCourierAnimation } from './map/courierAnimation'
import { getCourier } from '../../domain/delivery/couriers'
import { getMapPadding, hasMapDimensions } from './map/mapViewport'
import type { DeliveryLocation } from '../../domain/delivery/locations'
import type { DeliveryRouteLeg } from '../../domain/delivery/types'
import 'maplibre-gl/dist/maplibre-gl.css'

setWorkerUrl(mapWorkerUrl)

const mapStyle = 'https://tiles.openfreemap.org/styles/liberty'
const routeSourceId = 'cartopia-delivery-route'
const routeLayerId = 'cartopia-delivery-route-line'

interface DeliveryMapProps {
  origin: DeliveryLocation
  destination: DeliveryLocation
  stops?: Array<Omit<DeliveryLocation, 'code'> & { code: string; arrivesAt?: string }>
  routeLegs?: DeliveryRouteLeg[]
  courier: string
  startsAt: string
  arrivesAt: string
}

function createMarkerElement(kind: 'origin' | 'destination', label: string): HTMLDivElement {
  const element = document.createElement('div')
  element.className = `delivery-map-marker ${kind}`
  element.setAttribute('aria-label', label)
  element.setAttribute('role', 'img')
  return element
}

function createCourierElement(courier: string): HTMLDivElement {
  const element = document.createElement('div')
  element.className = 'delivery-map-marker courier'
  const courierOption = getCourier(courier)
  element.setAttribute('aria-label', `Entregador ${courierOption.label}`)
  element.setAttribute('role', 'img')

  const image = document.createElement('img')
  image.src = courierOption.iconAsset
  image.alt = ''
  image.draggable = false
  image.addEventListener('error', () => {
    image.remove()
    element.classList.add('fallback')
    element.textContent = '✉'
  }, { once: true })
  element.appendChild(image)

  return element
}

export function DeliveryMap({ origin, destination, stops = [], routeLegs = [], courier, startsAt, arrivesAt }: DeliveryMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<Map | null>(null)
  const markersRef = useRef<Marker[]>([])
  const courierMarkerRef = useRef<Marker | null>(null)
  const courierRef = useRef(courier)
  const animationRef = useRef<ReturnType<typeof createCourierAnimation> | null>(null)
  const hasFittedRouteRef = useRef(false)
  const routeRef = useRef({ origin, destination, stops, startsAt, arrivesAt })
  const [mapError, setMapError] = useState(false)

  useEffect(() => {
    routeRef.current = { origin, destination, stops, startsAt, arrivesAt }
  }, [origin, destination, stops, startsAt, arrivesAt])

  useEffect(() => {
    courierRef.current = courier
    const marker = courierMarkerRef.current
    if (!marker) return

    const option = getCourier(courier)
    const element = marker.getElement()
    const image = element.querySelector('img')
    element.setAttribute('aria-label', `Entregador ${option.label}`)
    if (image) image.setAttribute('src', option.iconAsset)
  }, [courier])

  const fitRoute = useCallback((map: Map) => {
    const container = containerRef.current
    if (!container || !hasMapDimensions(container.clientWidth, container.clientHeight)) return false

    map.resize()
    const routeLocations = [routeRef.current.origin, ...routeRef.current.stops, routeRef.current.destination]
    const coordinates = routeLocations.map((location) => location.coordinates)
    const longitudes = coordinates.map(([longitude]) => longitude)
    const latitudes = coordinates.map(([, latitude]) => latitude)
    map.fitBounds(new LngLatBounds([[Math.min(...longitudes), Math.min(...latitudes)], [Math.max(...longitudes), Math.max(...latitudes)]]), {
      padding: getMapPadding(container.clientWidth, container.clientHeight),
      maxZoom: 12,
      duration: 0,
    })
    hasFittedRouteRef.current = true
    return true
  }, [])

  const drawRoute = useCallback((map: Map) => {
    const { origin: currentOrigin, destination: currentDestination, stops: currentStops } = routeRef.current
    const routeLocations = [currentOrigin, ...currentStops, currentDestination]
    const route = {
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'LineString' as const,
        coordinates: routeLocations.map((location) => location.coordinates),
      },
    }

    const source = map.getSource(routeSourceId)
    if (source?.type === 'geojson') {
      (source as GeoJSONSource).setData(route)
    } else {
      map.addSource(routeSourceId, { type: 'geojson', data: route })
      map.addLayer({
        id: routeLayerId,
        type: 'line',
        source: routeSourceId,
        paint: { 'line-color': '#e3b65d', 'line-width': 4, 'line-opacity': 0.9 },
      })
    }

    markersRef.current.forEach((marker) => marker.remove())
    markersRef.current = routeLocations.map((location, index) => new Marker({ element: createMarkerElement(index === 0 ? 'origin' : index === routeLocations.length - 1 ? 'destination' : 'origin', `${index === 0 ? 'Origem' : index === routeLocations.length - 1 ? 'Destino' : 'Parada'}: ${location.label}`) }).setLngLat(location.coordinates).addTo(map))

    if (!courierMarkerRef.current) {
      courierMarkerRef.current = new Marker({ element: createCourierElement(courierRef.current) }).setLngLat(currentOrigin.coordinates).addTo(map)
    }

    animationRef.current?.stop()
    const animationPoints = [
      { coordinates: currentOrigin.coordinates, arrivesAt: routeRef.current.startsAt },
      ...currentStops.map((stop) => ({ coordinates: stop.coordinates, arrivesAt: stop.arrivesAt ?? routeRef.current.arrivesAt })),
      { coordinates: currentDestination.coordinates, arrivesAt: routeRef.current.arrivesAt },
    ]
    const animationLegs = animationPoints.slice(1).map((point, index) => ({
      origin: animationPoints[index].coordinates,
      destination: point.coordinates,
      startsAt: animationPoints[index].arrivesAt,
      arrivesAt: point.arrivesAt,
    })).filter((leg) => Date.parse(leg.arrivesAt) > Date.parse(leg.startsAt))

    animationRef.current = createCourierAnimation({
      marker: courierMarkerRef.current!,
      origin: currentOrigin.coordinates,
      destination: currentDestination.coordinates,
      startsAt: routeRef.current.startsAt,
      arrivesAt: routeRef.current.arrivesAt,
      legs: animationLegs.length === routeLocations.length - 1 ? animationLegs : routeLegs.map((leg, index) => ({
        origin: routeLocations[index].coordinates,
        destination: routeLocations[index + 1].coordinates,
        startsAt: leg.starts_at,
        arrivesAt: leg.arrives_at,
      })),
      scheduler: {
        requestFrame: (callback) => window.requestAnimationFrame(callback),
        cancelFrame: (frame) => window.cancelAnimationFrame(frame),
        now: () => Date.now(),
        prefersReducedMotion: () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      },
    })
    animationRef.current.start()
    hasFittedRouteRef.current = false
    fitRoute(map)
  }, [fitRoute])

  useEffect(() => {
    if (!containerRef.current) return

    let map: Map
    let resizeObserver: ResizeObserver | null = null

    try {
      map = new Map({
        container: containerRef.current,
        style: mapStyle,
        center: [0, 0],
        zoom: 10,
        attributionControl: false,
      })
      map.addControl(new NavigationControl({ showCompass: false }), 'top-right')
      map.addControl(new AttributionControl({ compact: true, customAttribution: '© OpenFreeMap · © OpenStreetMap contributors' }))
      map.on('error', () => setMapError(true))
      map.once('load', () => drawRoute(map))
      mapRef.current = map

      resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => {
        map.resize()
        if (!hasFittedRouteRef.current && map.isStyleLoaded()) fitRoute(map)
      })
      if (resizeObserver && containerRef.current) resizeObserver.observe(containerRef.current)

    } catch {
      window.setTimeout(() => setMapError(true), 0)
      return
    }

    return () => {
      resizeObserver?.disconnect()
      markersRef.current.forEach((marker) => marker.remove())
      markersRef.current = []
      animationRef.current?.stop()
      animationRef.current = null
      courierMarkerRef.current?.remove()
      courierMarkerRef.current = null
      map.remove()
      mapRef.current = null
    }
  }, [drawRoute, fitRoute])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    if (map.isStyleLoaded()) drawRoute(map)
  }, [drawRoute, origin, destination])

  return <div className="delivery-map-wrapper">
    <div ref={containerRef} className="delivery-map" aria-label={`Mapa da rota entre ${origin.label} e ${destination.label}`} />
    {mapError && <p className="delivery-map-fallback" role="status">O mapa não pôde ser carregado, mas o acompanhamento continua disponível.</p>}
  </div>
}
