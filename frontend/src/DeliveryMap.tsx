import { useCallback, useEffect, useRef, useState } from 'react'
import { AttributionControl, LngLatBounds, Map, Marker, NavigationControl, setWorkerUrl } from 'maplibre-gl'
import mapWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import type { GeoJSONSource } from 'maplibre-gl'
import { createCourierAnimation } from './courierAnimation'
import { getCourier } from './couriers'
import { getMapPadding, getRouteBounds, hasMapDimensions } from './mapViewport'
import type { DeliveryLocation } from './locations'
import 'maplibre-gl/dist/maplibre-gl.css'

setWorkerUrl(mapWorkerUrl)

const mapStyle = 'https://tiles.openfreemap.org/styles/liberty'
const routeSourceId = 'cartopia-delivery-route'
const routeLayerId = 'cartopia-delivery-route-line'

interface DeliveryMapProps {
  origin: DeliveryLocation
  destination: DeliveryLocation
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
  image.src = courierOption.asset
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

export function DeliveryMap({ origin, destination, courier, startsAt, arrivesAt }: DeliveryMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<Map | null>(null)
  const markersRef = useRef<Marker[]>([])
  const courierMarkerRef = useRef<Marker | null>(null)
  const courierRef = useRef(courier)
  const animationRef = useRef<ReturnType<typeof createCourierAnimation> | null>(null)
  const hasFittedRouteRef = useRef(false)
  const routeRef = useRef({ origin, destination, startsAt, arrivesAt })
  const [mapError, setMapError] = useState(false)

  useEffect(() => {
    routeRef.current = { origin, destination, startsAt, arrivesAt }
  }, [origin, destination, startsAt, arrivesAt])

  useEffect(() => {
    courierRef.current = courier
    const marker = courierMarkerRef.current
    if (!marker) return

    const option = getCourier(courier)
    const element = marker.getElement()
    const image = element.querySelector('img')
    element.setAttribute('aria-label', `Entregador ${option.label}`)
    if (image) image.setAttribute('src', option.asset)
  }, [courier])

  const fitRoute = useCallback((map: Map) => {
    const container = containerRef.current
    if (!container || !hasMapDimensions(container.clientWidth, container.clientHeight)) return false

    map.resize()
    map.fitBounds(new LngLatBounds(getRouteBounds(routeRef.current.origin.coordinates, routeRef.current.destination.coordinates)), {
      padding: getMapPadding(container.clientWidth, container.clientHeight),
      maxZoom: 12,
      duration: 0,
    })
    hasFittedRouteRef.current = true
    return true
  }, [])

  const drawRoute = useCallback((map: Map) => {
    const { origin: currentOrigin, destination: currentDestination } = routeRef.current
    const route = {
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'LineString' as const,
        coordinates: [currentOrigin.coordinates, currentDestination.coordinates],
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
        paint: { 'line-color': '#f1b47f', 'line-width': 4, 'line-opacity': 0.9 },
      })
    }

    markersRef.current.forEach((marker) => marker.remove())
    markersRef.current = [
      new Marker({ element: createMarkerElement('origin', `Origem: ${currentOrigin.label}`) }).setLngLat(currentOrigin.coordinates).addTo(map),
      new Marker({ element: createMarkerElement('destination', `Destino: ${currentDestination.label}`) }).setLngLat(currentDestination.coordinates).addTo(map),
    ]

    if (!courierMarkerRef.current) {
      courierMarkerRef.current = new Marker({ element: createCourierElement(courierRef.current) }).setLngLat(currentOrigin.coordinates).addTo(map)
    }

    animationRef.current?.stop()
    animationRef.current = createCourierAnimation({
      marker: courierMarkerRef.current!,
      origin: currentOrigin.coordinates,
      destination: currentDestination.coordinates,
      startsAt: routeRef.current.startsAt,
      arrivesAt: routeRef.current.arrivesAt,
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
