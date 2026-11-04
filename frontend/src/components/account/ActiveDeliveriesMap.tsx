import { useEffect, useRef, useState } from 'react'
import { AttributionControl, LngLatBounds, Map, Marker, NavigationControl, setWorkerUrl } from 'maplibre-gl'
import mapWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import type { ActiveMapDelivery } from '../../services/api'
import { activeMapColors, activeMapPosition, activeMapRoute } from './activeMapRoutes'
import { getCourier } from '../../domain/delivery/couriers'
import 'maplibre-gl/dist/maplibre-gl.css'

setWorkerUrl(mapWorkerUrl)

type Props = {
  deliveries: ActiveMapDelivery[]
  selectedId: string | null
  onSelect: (publicId: string | null) => void
}

export function ActiveDeliveriesMap({ deliveries, selectedId, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<Map | null>(null)
  const markersRef = useRef<Marker[]>([])
  const fittedDeliveriesRef = useRef('')
  const [mapError, setMapError] = useState(false)
  useEffect(() => {
    if (selectedId && !deliveries.some((delivery) => delivery.public_id === selectedId)) {
      onSelect(null)
    }
  }, [deliveries, selectedId, onSelect])

  useEffect(() => {
    if (!containerRef.current) return
    let map: Map
    try {
      map = new Map({
        container: containerRef.current,
        style: 'https://tiles.openfreemap.org/styles/liberty',
        center: [0, 0],
        zoom: 2,
        attributionControl: false,
      })
      map.addControl(new NavigationControl({ showCompass: false }), 'top-right')
      map.addControl(new AttributionControl({ compact: true, customAttribution: '© OpenFreeMap · © OpenStreetMap contributors' }))
      map.on('error', () => setMapError(true))
      mapRef.current = map
    } catch {
      setMapError(true)
      return
    }
    return () => {
      markersRef.current.forEach((marker) => marker.remove())
      markersRef.current = []
      mapRef.current = null
      map.remove()
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const routes = deliveries.flatMap((delivery, index) => {
      const route = activeMapRoute(delivery)
      return route ? [{ delivery, route, color: activeMapColors[index], index }] : []
    }).filter(({ delivery }) => !selectedId || delivery.public_id === selectedId)
    let active = true
    let frame = 0

    function draw() {
      if (!active || !map) return
      markersRef.current.forEach((marker) => marker.remove())
      markersRef.current = []

      for (let index = 0; index < 5; index++) {
        const layerId = `active-route-${index}`
        if (map.getLayer(layerId)) map.removeLayer(layerId)
        if (map.getSource(layerId)) map.removeSource(layerId)
      }

      const bounds = new LngLatBounds()
      for (const { delivery, route, color, index } of routes) {
        const layerId = `active-route-${index}`
        map.addSource(layerId, {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: { type: 'LineString', coordinates: [route.origin, route.destination] },
          },
        })
        map.addLayer({
          id: layerId,
          type: 'line',
          source: layerId,
          paint: { 'line-color': color, 'line-width': 4, 'line-opacity': 0.85 },
        })

        for (const [kind, coordinates] of [
          ['Origem', route.origin],
          ['Destino', route.destination],
        ] as const) {
          const element = document.createElement('span')
          element.className = 'active-map-endpoint'
          element.style.backgroundColor = color
          element.setAttribute('aria-label', `${kind}: entrega para ${delivery.recipient_name}`)
          markersRef.current.push(new Marker({ element }).setLngLat(coordinates).addTo(map))
        }

        const courier = document.createElement('span')
        courier.className = 'active-map-courier'
        courier.style.borderColor = color
        courier.tabIndex = 0
        courier.setAttribute('role', 'button')
        const courierOption = getCourier(delivery.courier)
        courier.setAttribute('aria-label', `Focar ${courierOption.label}, entrega para ${delivery.recipient_name}`)
        courier.addEventListener('click', () => onSelect(delivery.public_id))
        courier.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onSelect(delivery.public_id)
          }
        })
        const image = document.createElement('img')
        image.src = courierOption.iconAsset
        image.alt = ''
        image.draggable = false
        image.addEventListener('error', () => {
          image.remove()
          courier.textContent = '✉'
        }, { once: true })
        courier.appendChild(image)
        const marker = new Marker({ element: courier })
          .setLngLat(activeMapPosition(delivery, Date.now()) ?? route.origin)
          .addTo(map)
        markersRef.current.push(marker)
        bounds.extend(route.origin).extend(route.destination)
      }

      const deliveryIds = routes.map(({ delivery }) => delivery.public_id).join(',')
      if (routes.length > 0 && fittedDeliveriesRef.current !== deliveryIds) {
        map.fitBounds(bounds, { padding: 50, maxZoom: 12, duration: 0 })
        fittedDeliveriesRef.current = deliveryIds
      }

      const courierMarkers = routes.map((_, index) => markersRef.current[index * 3 + 2])
      const animate = () => {
        if (!active) return
        const now = Date.now()
        routes.forEach(({ delivery }, index) => {
          const position = activeMapPosition(delivery, now)
          if (position) courierMarkers[index].setLngLat(position)
        })
        frame = window.requestAnimationFrame(animate)
      }
      frame = window.requestAnimationFrame(animate)
    }

    if (map.isStyleLoaded()) draw()
    else map.once('load', draw)

    return () => {
      active = false
      window.cancelAnimationFrame(frame)
      map.off('load', draw)
    }
  }, [deliveries, selectedId, onSelect])

  return (
    <div className="active-map-wrapper">
      <div ref={containerRef} className="active-map-canvas" role="group" aria-label="Mapa simultâneo das entregas em andamento" />
      {selectedId && (
        <button
          type="button"
          className="active-map-show-all"
          onClick={() => onSelect(null)}
        >
          Mostrar todas
        </button>
      )}
      {mapError && <p className="delivery-map-fallback" role="status">Não foi possível carregar o mapa agora. As entregas continuam listadas abaixo.</p>}
    </div>
  )
}
