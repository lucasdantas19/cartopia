import { colors } from '../src/theme'
import { useCallback, useState } from 'react'
import { Link, useFocusEffect } from 'expo-router'
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ApiError, deleteLocation, fetchSavedLocations, saveLocation, setDefaultLocation, updateLocation } from '../src/api'
import { RealLocationPicker } from '../src/components/RealLocationPicker'
import { useSession } from '../src/context/SessionContext'
import type { DeliveryLocation, PaginationMeta, SavedLocation } from '../src/domain'

const mapCenter = { latitude: -8.047, longitude: -34.912 }

export default function LocationsScreen() {
  const { session } = useSession()
  const [locations, setLocations] = useState<SavedLocation[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [page, setPage] = useState(1)
  const [meta, setMeta] = useState<PaginationMeta | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [selected, setSelected] = useState<DeliveryLocation | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)

  const load = useCallback(async (currentPage = page) => {
    if (!session) return
    setLoading(true)
    setError('')
    try {
      const response = await fetchSavedLocations(session.token, currentPage)
      setLocations(response.data)
      setMeta(response.meta)
      setPage(response.meta.current_page)
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Não foi possível carregar seus locais.')
    } finally {
      setLoading(false)
    }
  }, [page, session?.token])

  useFocusEffect(useCallback(() => {
    void load()
  }, [load]))

  async function addLocation() {
    if (!session || !name.trim() || !selected) {
      setError('Informe um nome e escolha um ponto no mapa.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const input = { name: name.trim(), label: selected.label, latitude: selected.latitude, longitude: selected.longitude }
      if (editingId) await updateLocation(editingId, input, session.token)
      else await saveLocation(input, session.token)
      setName('')
      setSelected(null)
      setEditingId(null)
      await load()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Não foi possível salvar o local.')
    } finally {
      setSaving(false)
    }
  }

  function edit(location: SavedLocation) {
    setEditingId(location.id)
    setName(location.name)
    setSelected({ label: location.label, latitude: location.latitude, longitude: location.longitude })
  }

  function remove(location: SavedLocation) {
    if (!session) return
    Alert.alert('Remover local?', `O local “${location.name}” será apagado.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: () => {
          void deleteLocation(location.id, session.token).then(() => load()).catch(() => setError('Não foi possível remover o local.'))
        },
      },
    ])
  }

  async function toggleDefault(location: SavedLocation) {
    if (!session) return
    try {
      await setDefaultLocation(location.id, session.token)
      await load()
    } catch {
      setError('Não foi possível atualizar o local padrão.')
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {pickerOpen ? (
        <RealLocationPicker
          kind="origin"
          initialCenter={selected ?? mapCenter}
          initialLocation={selected}
          otherLocation={null}
          onClose={() => setPickerOpen(false)}
          onSelect={(location) => {
            setSelected(location)
            setPickerOpen(false)
          }}
        />
      ) : null}
      <ScrollView contentContainerStyle={styles.container}>
        <Link href="/(tabs)/account" style={styles.back}>← Conta</Link>
        <Text style={styles.eyebrow}>PREFERÊNCIAS</Text>
        <Text style={styles.title}>Locais salvos</Text>
        <Text style={styles.description}>Guarde lugares para reutilizar nas próximas entregas.</Text>

        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>{editingId ? 'Editar local' : 'Adicionar local'}</Text>
          <TextInput
            accessibilityLabel="Nome do local"
            onChangeText={setName}
            placeholder="Ex.: Casa"
            style={styles.input}
            value={name}
          />
          <Pressable accessibilityRole="button" onPress={() => setPickerOpen(true)} style={styles.secondaryButton}>
            <Text style={styles.secondaryText}>{selected ? selected.label : 'Escolher no mapa'}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" disabled={saving} onPress={() => void addLocation()} style={styles.primaryButton}>
            {saving ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.primaryText}>{editingId ? 'Atualizar local' : 'Salvar local'}</Text>}
          </Pressable>
          {editingId ? (
            <Pressable onPress={() => { setEditingId(null); setName(''); setSelected(null) }} style={styles.cancelButton}>
              <Text style={styles.cancelText}>Cancelar edição</Text>
            </Pressable>
          ) : null}
        </View>

        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        {loading ? <ActivityIndicator color={colors.primary} style={styles.loading} /> : null}
        {!loading && locations.length === 0 ? <Text style={styles.empty}>Nenhum local salvo.</Text> : null}
        {locations.map((location) => (
          <View key={location.id} style={styles.card}>
            <Text style={styles.cardTitle}>{location.name}</Text>
            <Text style={styles.cardLabel}>{location.label}</Text>
            {location.is_default ? <Text style={styles.default}>Local padrão</Text> : null}
            <View style={styles.actions}>
              <Pressable onPress={() => edit(location)} style={styles.actionButton}>
                <Text style={styles.actionText}>Editar</Text>
              </Pressable>
              {!location.is_default ? (
                <Pressable onPress={() => void toggleDefault(location)} style={styles.actionButton}>
                  <Text style={styles.actionText}>Tornar padrão</Text>
                </Pressable>
              ) : null}
              <Pressable onPress={() => remove(location)} style={styles.actionButton}>
                <Text style={styles.removeText}>Remover</Text>
              </Pressable>
            </View>
          </View>
        ))}
        {meta && meta.last_page > 1 ? (
          <View style={styles.pagination}>
            <Pressable disabled={page === 1} onPress={() => void load(page - 1)} style={styles.actionButton}>
              <Text style={styles.actionText}>Anterior</Text>
            </Pressable>
            <Text style={styles.pageLabel}>Página {page} de {meta.last_page}</Text>
            <Pressable disabled={page === meta.last_page} onPress={() => void load(page + 1)} style={styles.actionButton}>
              <Text style={styles.actionText}>Próxima</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  container: { flexGrow: 1, padding: 24, paddingBottom: 40 },
  back: { color: colors.primary, fontSize: 15, fontWeight: '800', marginBottom: 28 },
  eyebrow: { color: colors.primary, fontSize: 12, fontWeight: '800', letterSpacing: 2, marginBottom: 10 },
  title: { color: colors.ink, fontSize: 32, fontWeight: '800' },
  description: { color: colors.muted, fontSize: 15, lineHeight: 22, marginTop: 8 },
  formCard: { backgroundColor: '#ffffff', borderColor: colors.line, borderRadius: 18, borderWidth: 1, marginTop: 24, padding: 18 },
  sectionTitle: { color: colors.ink, fontSize: 18, fontWeight: '800', marginBottom: 12 },
  input: { borderColor: colors.line, borderRadius: 10, borderWidth: 1, fontSize: 16, minHeight: 48, paddingHorizontal: 12 },
  primaryButton: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: 12, justifyContent: 'center', minHeight: 48, marginTop: 10, paddingHorizontal: 16 },
  primaryText: { color: '#ffffff', fontSize: 15, fontWeight: '800' },
  cancelButton: { alignItems: 'center', justifyContent: 'center', minHeight: 42, marginTop: 6 },
  cancelText: { color: colors.muted, fontSize: 14, fontWeight: '700' },
  secondaryButton: { alignItems: 'center', borderColor: colors.line, borderRadius: 12, borderWidth: 1, justifyContent: 'center', minHeight: 48, marginTop: 10, paddingHorizontal: 12 },
  secondaryText: { color: colors.primary, fontSize: 15, fontWeight: '700' },
  error: { color: '#b42318', fontSize: 14, lineHeight: 20, marginTop: 16 },
  loading: { marginVertical: 28 },
  empty: { color: colors.muted, marginTop: 24 },
  card: { backgroundColor: '#ffffff', borderColor: colors.line, borderRadius: 16, borderWidth: 1, marginTop: 12, padding: 16 },
  cardTitle: { color: colors.ink, fontSize: 17, fontWeight: '800' },
  cardLabel: { color: colors.muted, fontSize: 14, marginTop: 5 },
  default: { color: colors.primary, fontSize: 13, fontWeight: '800', marginTop: 8 },
  actions: { flexDirection: 'row', gap: 16, marginTop: 14 },
  actionButton: { minHeight: 40, justifyContent: 'center' },
  actionText: { color: colors.primary, fontSize: 14, fontWeight: '700' },
  removeText: { color: '#b42318', fontSize: 14, fontWeight: '700' },
  pagination: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
  pageLabel: { color: colors.muted, fontSize: 13, fontWeight: '700' },
})
