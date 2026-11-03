import { useRef, useState } from 'react'
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import MapView, { Marker, type LatLng } from 'react-native-maps'
import { mapboxAccessToken } from '../config'
import type { DeliveryLocation } from '../domain'

type PlaceFeature = {
  id?: string
  properties?: {
    name?: string
    full_address?: string
  }
  geometry?: {
    coordinates?: [number, number]
  }
}

type Props = {
  kind: 'origin' | 'destination'
  initialCenter: LatLng
  initialLocation: DeliveryLocation | null
  otherLocation: DeliveryLocation | null
  onClose: () => void
  onSelect: (location: DeliveryLocation) => void
}

function placeLabel(feature: PlaceFeature) {
  return feature.properties?.full_address || feature.properties?.name || 'Lugar encontrado'
}

export function RealLocationPicker({ kind, initialCenter, initialLocation, otherLocation, onClose, onSelect }: Props) {
  const mapRef = useRef<MapView>(null)
  const [point, setPoint] = useState<LatLng | null>(initialLocation)
  const [label, setLabel] = useState(initialLocation?.label ?? '')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PlaceFeature[]>([])
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')

  function choosePoint(coordinate: LatLng) {
    setPoint(coordinate)
    setLabel('')
    setResults([])
    setError('')
  }

  async function searchPlaces() {
    if (!mapboxAccessToken) return
    const search = query.trim()
    if (search.length < 3) {
      setError('Digite pelo menos 3 caracteres para pesquisar.')
      return
    }

    setSearching(true)
    setError('')
    setResults([])
    try {
      const params = new URLSearchParams({
        q: search,
        access_token: mapboxAccessToken,
        autocomplete: 'false',
        limit: '5',
        language: 'pt',
      })
      const response = await fetch(`https://api.mapbox.com/search/geocode/v6/forward?${params}`)
      if (!response.ok) throw new Error('Place search failed')

      const payload = await response.json() as { features?: PlaceFeature[] }
      const features = (payload.features ?? []).filter((feature) => {
        const coordinates = feature.geometry?.coordinates
        return coordinates?.length === 2 && coordinates.every(Number.isFinite)
      })
      setResults(features)
      if (!features.length) setError('Nenhum lugar encontrado. Você também pode tocar no mapa.')
    } catch {
      setError('Não foi possível pesquisar agora. Tente escolher o ponto no mapa.')
    } finally {
      setSearching(false)
    }
  }

  function selectResult(feature: PlaceFeature) {
    const coordinates = feature.geometry?.coordinates
    if (!coordinates) return

    const selected = { latitude: coordinates[1], longitude: coordinates[0] }
    setPoint(selected)
    setLabel(placeLabel(feature))
    setQuery(placeLabel(feature))
    setResults([])
    setError('')
    Keyboard.dismiss()
    mapRef.current?.animateToRegion({ ...selected, latitudeDelta: 0.03, longitudeDelta: 0.03 }, 350)
  }

  function confirm() {
    const name = label.trim()
    if (!point) {
      setError('Pesquise um lugar ou toque no mapa para marcar o ponto.')
      return
    }
    if (!name || name.length > 160) {
      setError('Dê um nome ao lugar com até 160 caracteres.')
      return
    }
    if (otherLocation?.latitude === point.latitude && otherLocation.longitude === point.longitude) {
      setError('Escolha um ponto diferente do outro lugar da rota.')
      return
    }

    Keyboard.dismiss()
    onSelect({ label: name, latitude: point.latitude, longitude: point.longitude })
  }

  return (
    <Modal animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen" visible>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.container}
        >
          <View style={styles.header}>
            <Pressable accessibilityRole="button" onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>Cancelar</Text>
            </Pressable>
            <Text style={styles.title}>
              {kind === 'origin' ? 'Escolher origem' : 'Escolher destino'}
            </Text>
          </View>
          <Text style={styles.instruction}>
            Pesquise um endereço ou toque no mapa para marcar {kind === 'origin' ? 'de onde a carta vai partir' : 'onde a carta vai chegar'}.
          </Text>

          {mapboxAccessToken ? (
            <View style={styles.searchArea}>
              <Text style={styles.label}>Pesquisar lugar ou endereço</Text>
              <View style={styles.searchRow}>
                <TextInput
                  accessibilityLabel="Pesquisar lugar ou endereço"
                  autoCorrect={false}
                  onChangeText={setQuery}
                  onSubmitEditing={() => void searchPlaces()}
                  placeholder="Ex.: Parque da Jaqueira"
                  returnKeyType="search"
                  style={styles.searchInput}
                  value={query}
                />
                <Pressable
                  accessibilityRole="button"
                  disabled={searching}
                  onPress={() => void searchPlaces()}
                  style={styles.searchButton}
                >
                  {searching ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text style={styles.searchButtonText}>Buscar</Text>
                  )}
                </Pressable>
              </View>
              {results.length > 0 ? (
                <ScrollView keyboardShouldPersistTaps="always" style={styles.results}>
                  {results.map((feature, index) => (
                    <Pressable
                      accessibilityRole="button"
                      key={feature.id ?? index}
                      onPress={() => selectResult(feature)}
                      style={styles.result}
                    >
                      <Text style={styles.resultText}>{placeLabel(feature)}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              ) : null}
            </View>
          ) : null}

          <MapView
            initialRegion={{
              latitude: initialLocation?.latitude ?? initialCenter.latitude,
              longitude: initialLocation?.longitude ?? initialCenter.longitude,
              latitudeDelta: initialLocation ? 0.03 : 0.08,
              longitudeDelta: initialLocation ? 0.03 : 0.08,
            }}
            onPress={(event) => choosePoint(event.nativeEvent.coordinate)}
            ref={mapRef}
            style={styles.map}
          >
            {point ? (
              <Marker
                coordinate={point}
                draggable
                onDragEnd={(event) => choosePoint(event.nativeEvent.coordinate)}
                title={label || (kind === 'origin' ? 'Origem marcada' : 'Destino marcado')}
              />
            ) : null}
          </MapView>

          <View style={styles.footer}>
            <Text style={styles.label}>Nome do lugar marcado</Text>
            <TextInput
              accessibilityLabel="Nome do lugar marcado"
              maxLength={160}
              onChangeText={(value) => {
                setLabel(value)
                setError('')
              }}
              placeholder="Ex.: Parque da Jaqueira"
              style={styles.nameInput}
              value={label}
            />
            {point ? (
              <Text style={styles.coordinates}>
                {point.latitude.toFixed(5)}, {point.longitude.toFixed(5)}
              </Text>
            ) : null}
            {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
            <Pressable accessibilityRole="button" onPress={confirm} style={styles.confirmButton}>
              <Text style={styles.confirmText}>
                {kind === 'origin' ? 'Usar esta origem' : 'Usar este destino'}
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: '#fffaf4', flex: 1 },
  container: { flex: 1 },
  header: { alignItems: 'center', flexDirection: 'row', paddingHorizontal: 16, paddingTop: 8 },
  closeButton: { minHeight: 48, justifyContent: 'center', paddingRight: 16 },
  closeText: { color: '#7c3aed', fontSize: 16, fontWeight: '700' },
  title: { color: '#241b35', fontSize: 22, fontWeight: '800' },
  instruction: { color: '#665d70', fontSize: 14, lineHeight: 21, paddingHorizontal: 18, paddingVertical: 12 },
  searchArea: { paddingHorizontal: 18, paddingBottom: 10 },
  label: { color: '#241b35', fontSize: 14, fontWeight: '700', marginBottom: 7 },
  searchRow: { flexDirection: 'row', gap: 8 },
  searchInput: { backgroundColor: '#ffffff', borderColor: '#e5dcef', borderRadius: 10, borderWidth: 1, flex: 1, fontSize: 15, minHeight: 48, paddingHorizontal: 12 },
  searchButton: { alignItems: 'center', backgroundColor: '#7c3aed', borderRadius: 10, justifyContent: 'center', minHeight: 48, paddingHorizontal: 14 },
  searchButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  results: { backgroundColor: '#ffffff', borderColor: '#e5dcef', borderRadius: 10, borderWidth: 1, maxHeight: 170, marginTop: 8 },
  result: { borderBottomColor: '#eee8f7', borderBottomWidth: 1, minHeight: 48, justifyContent: 'center', padding: 12 },
  resultText: { color: '#241b35', fontSize: 14 },
  map: { flex: 1, minHeight: 180 },
  footer: { backgroundColor: '#fffaf4', padding: 18 },
  nameInput: { backgroundColor: '#ffffff', borderColor: '#e5dcef', borderRadius: 10, borderWidth: 1, fontSize: 16, minHeight: 48, paddingHorizontal: 12 },
  coordinates: { color: '#665d70', fontSize: 12, marginTop: 7 },
  error: { color: '#b42318', fontSize: 13, lineHeight: 18, marginTop: 9 },
  confirmButton: { alignItems: 'center', backgroundColor: '#7c3aed', borderRadius: 12, justifyContent: 'center', minHeight: 50, marginTop: 12 },
  confirmText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
})
