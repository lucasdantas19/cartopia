import { useState } from 'react'
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
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
  initialCenter: { latitude: number; longitude: number }
  initialLocation: DeliveryLocation | null
  otherLocation: DeliveryLocation | null
  onClose: () => void
  onSelect: (location: DeliveryLocation) => void
}

function placeLabel(feature: PlaceFeature) {
  return feature.properties?.full_address || feature.properties?.name || 'Lugar encontrado'
}

export function RealLocationPicker({ kind, initialLocation, otherLocation, onClose, onSelect }: Props) {
  const [query, setQuery] = useState(initialLocation?.label ?? '')
  const [results, setResults] = useState<PlaceFeature[]>([])
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')

  async function searchPlaces() {
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
      if (!features.length) setError('Nenhum lugar encontrado. Tente outra busca.')
    } catch {
      setError('Não foi possível pesquisar agora. Tente novamente.')
    } finally {
      setSearching(false)
    }
  }

  function selectResult(feature: PlaceFeature) {
    const coordinates = feature.geometry?.coordinates
    if (!coordinates) return

    const location = {
      label: placeLabel(feature),
      latitude: coordinates[1],
      longitude: coordinates[0],
    }
    if (otherLocation?.latitude === location.latitude && otherLocation.longitude === location.longitude) {
      setError('Escolha um ponto diferente do outro lugar da rota.')
      return
    }

    onSelect(location)
  }

  return (
    <Modal animationType="slide" onRequestClose={onClose} visible>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeText}>Cancelar</Text>
          </Pressable>
          <Text style={styles.title}>
            {kind === 'origin' ? 'Escolher origem' : 'Escolher destino'}
          </Text>
        </View>

        <Text style={styles.instruction}>Pesquise um endereço ou lugar real para a rota.</Text>

        {mapboxAccessToken ? (
          <View style={styles.searchArea}>
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
        ) : (
          <Text style={styles.error}>
            Configure EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN para buscar lugares no navegador.
          </Text>
        )}

        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}

        <ScrollView contentContainerStyle={styles.results} keyboardShouldPersistTaps="always">
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
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#fffaf4', flex: 1, padding: 18 },
  header: { alignItems: 'center', flexDirection: 'row' },
  closeButton: { minHeight: 48, justifyContent: 'center', paddingRight: 16 },
  closeText: { color: '#7c3aed', fontSize: 16, fontWeight: '700' },
  title: { color: '#241b35', fontSize: 22, fontWeight: '800' },
  instruction: { color: '#665d70', fontSize: 14, lineHeight: 21, marginVertical: 12 },
  searchArea: { flexDirection: 'row', gap: 8 },
  searchInput: { backgroundColor: '#ffffff', borderColor: '#e5dcef', borderRadius: 10, borderWidth: 1, flex: 1, fontSize: 15, minHeight: 48, paddingHorizontal: 12 },
  searchButton: { alignItems: 'center', backgroundColor: '#7c3aed', borderRadius: 10, justifyContent: 'center', minHeight: 48, paddingHorizontal: 14 },
  searchButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  error: { color: '#b42318', fontSize: 13, lineHeight: 18, marginTop: 12 },
  results: { gap: 8, paddingTop: 16 },
  result: { backgroundColor: '#ffffff', borderColor: '#e5dcef', borderRadius: 10, borderWidth: 1, minHeight: 48, justifyContent: 'center', padding: 12 },
  resultText: { color: '#241b35', fontSize: 14 },
})
