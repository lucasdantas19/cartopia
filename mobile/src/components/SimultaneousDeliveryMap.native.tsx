import { Fragment, useEffect, useRef, useState } from 'react'
import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import MapView, { Marker, Polyline } from 'react-native-maps'
import type { ActiveMapDelivery } from '../domain'
import { deliveryMapRoute, estimatedMapProgress, pointAlongRoute } from '../trackingMap'

export const deliveryColors = ['#7c3aed', '#d34841', '#087e74', '#ba6800', '#2163b5']

const courierImages = {
  'paper-swallow': require('../../assets/couriers/paper-swallow-icon.png'),
  'postal-cat': require('../../assets/couriers/postal-cat-icon.png'),
  'little-dragon': require('../../assets/couriers/little-dragon-icon.png'),
}

type Props = {
  deliveries: ActiveMapDelivery[]
  fetchedAt: number
  selectedId: string | null
  onSelect: (publicId: string | null) => void
}

export function SimultaneousDeliveryMap({ deliveries, fetchedAt, selectedId, onSelect }: Props) {
  const map = useRef<MapView>(null)
  const [now, setNow] = useState(Date.now())
  const routes = deliveries.flatMap((delivery, index) => {
    const route = deliveryMapRoute(delivery)
    return route ? [{ delivery, route, color: deliveryColors[index] }] : []
  })
  const visibleRoutes = selectedId
    ? routes.filter(({ delivery }) => delivery.public_id === selectedId)
    : routes

  useEffect(() => {
    setNow(Date.now())
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [fetchedAt])

  useEffect(() => {
    if (selectedId && !routes.some(({ delivery }) => delivery.public_id === selectedId)) {
      onSelect(null)
      return
    }
    const coordinates = visibleRoutes.flatMap(({ route }) => [route.origin, route.destination])
    if (coordinates.length === 0) return
    const frame = setTimeout(() => {
      map.current?.fitToCoordinates(coordinates, {
        edgePadding: { top: 56, right: 56, bottom: 56, left: 56 },
        animated: true,
      })
    }, 300)
    return () => clearTimeout(frame)
  }, [deliveries, selectedId, onSelect])

  if (routes.length === 0) return null

  return (
    <View style={styles.container}>
      <MapView
        ref={map}
        style={styles.map}
        initialRegion={{
          ...routes[0].route.origin,
          latitudeDelta: 0.5,
          longitudeDelta: 0.5,
        }}
      >
        {visibleRoutes.map(({ delivery, route, color }) => {
          const courierImage = courierImages[delivery.courier as keyof typeof courierImages]
          const position = pointAlongRoute(
            route.origin,
            route.destination,
            estimatedMapProgress(delivery, fetchedAt, now),
          )
          return (
            <Fragment key={delivery.public_id}>
              <Polyline coordinates={[route.origin, route.destination]} strokeColor={color} strokeWidth={4} />
              <Marker coordinate={route.origin} pinColor={color} title={`Origem: ${delivery.recipient_name}`} />
              <Marker coordinate={route.destination} pinColor={color} title={`Destino: ${delivery.recipient_name}`} />
              <Marker
                coordinate={position}
                title={`Para ${delivery.recipient_name}`}
                onPress={() => onSelect(delivery.public_id)}
              >
                <View style={[styles.marker, { borderColor: color }]}>
                  {courierImage ? (
                    <Image
                      source={courierImage}
                      style={styles.courierImage}
                    />
                  ) : (
                    <Text style={[styles.fallback, { color }]}>✉</Text>
                  )}
                </View>
              </Marker>
            </Fragment>
          )
        })}
      </MapView>
      {selectedId ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mostrar todas as entregas no mapa"
          onPress={() => onSelect(null)}
          style={styles.showAllButton}
        >
          <Text style={styles.showAllText}>Mostrar todas</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { height: 420, borderRadius: 18, overflow: 'hidden' },
  map: { flex: 1 },
  marker: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 27,
    borderWidth: 3,
    height: 54,
    justifyContent: 'center',
    width: 54,
  },
  courierImage: { borderRadius: 22, height: 44, width: 44 },
  fallback: { fontSize: 25 },
  showAllButton: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    elevation: 3,
  },
  showAllText: { color: '#7c3aed', fontWeight: '800' },
})
