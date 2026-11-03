import { useEffect, useRef, useState } from 'react'
import { Alert, Image, Pressable, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native'
import MapView, { Marker, Polyline } from 'react-native-maps'
import type { Delivery } from '../domain'
import { deliveryMapRoute, estimatedMapProgress, pointAlongRoute } from '../trackingMap'

type Props = {
  delivery: Delivery
  fetchedAt: number
  courierImage: ImageSourcePropType | undefined
}

export function DeliveryJourneyMap({ delivery, fetchedAt, courierImage }: Props) {
  const mapRef = useRef<MapView>(null)
  const [now, setNow] = useState(Date.now())
  const route = deliveryMapRoute(delivery)

  useEffect(() => {
    setNow(Date.now())
    if (delivery.status !== 'IN_TRANSIT') return

    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [delivery.status, fetchedAt])

  if (!route) return null

  const progress = estimatedMapProgress(delivery, fetchedAt, now)
  const position = pointAlongRoute(route.origin, route.destination, progress)
  const latitudeDelta = Math.max(Math.abs(route.destination.latitude - route.origin.latitude) * 1.5, 0.025)
  const longitudeDelta = Math.max(Math.abs(route.destination.longitude - route.origin.longitude) * 1.5, 0.025)

  function centerOnCourier() {
    mapRef.current?.animateToRegion({
      ...position,
      latitudeDelta: 0.03,
      longitudeDelta: 0.03,
    }, 350)
  }

  return (
    <View style={styles.container}>
      <View style={styles.mapContainer}>
        <MapView
          initialRegion={{
            latitude: (route.origin.latitude + route.destination.latitude) / 2,
            longitude: (route.origin.longitude + route.destination.longitude) / 2,
            latitudeDelta,
            longitudeDelta,
          }}
          ref={mapRef}
          style={styles.map}
        >
          <Polyline
            coordinates={[position, route.destination]}
            strokeColor="#b9a8d1"
            strokeWidth={4}
          />
          <Polyline
            coordinates={[route.origin, position]}
            strokeColor="#7c3aed"
            strokeWidth={5}
          />
          <Marker coordinate={route.origin} pinColor="#7c3aed" title="Origem" />
          <Marker coordinate={route.destination} pinColor="#e39b24" title="Destino" />
          <Marker coordinate={position} title="Posição estimada do entregador">
            <View style={styles.courierMarker}>
              {courierImage ? (
                <Image source={courierImage} style={styles.courierImage} />
              ) : (
                <Text style={styles.courierFallback}>✉</Text>
              )}
            </View>
          </Marker>
        </MapView>
        <Pressable
          accessibilityLabel="Como funciona o mapa da entrega"
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => Alert.alert(
            'Sobre o mapa',
            'O entregador avança entre origem e destino conforme o tempo da viagem. O trajeto não acompanha ruas nem usa GPS ao vivo.',
          )}
          style={styles.infoButton}
        >
          <Text style={styles.infoButtonText}>i</Text>
        </Pressable>
        <Pressable
          accessibilityLabel="Centralizar mapa no entregador"
          accessibilityRole="button"
          hitSlop={8}
          onPress={centerOnCourier}
          style={styles.centerButton}
        >
          <Text style={styles.centerButtonText}>⌖</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    marginTop: 16,
    overflow: 'hidden',
  },
  mapContainer: {
    height: 300,
    width: '100%',
  },
  map: {
    flex: 1,
  },
  infoButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e5dcef',
    borderRadius: 22,
    borderWidth: 1,
    elevation: 3,
    height: 44,
    justifyContent: 'center',
    left: 12,
    position: 'absolute',
    top: 12,
    width: 44,
    zIndex: 1,
  },
  infoButtonText: {
    color: '#4b2782',
    fontSize: 18,
    fontWeight: '800',
  },
  centerButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e5dcef',
    borderRadius: 22,
    borderWidth: 1,
    elevation: 3,
    height: 44,
    justifyContent: 'center',
    position: 'absolute',
    right: 12,
    top: 12,
    width: 44,
    zIndex: 1,
  },
  centerButtonText: {
    color: '#4b2782',
    fontSize: 28,
    fontWeight: '800',
  },
  courierMarker: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#7c3aed',
    borderRadius: 28,
    borderWidth: 3,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  courierImage: {
    borderRadius: 22,
    height: 44,
    width: 44,
  },
  courierFallback: {
    color: '#7c3aed',
    fontSize: 26,
  },
})
