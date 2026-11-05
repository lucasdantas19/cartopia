import { colors } from '../src/theme'
import { useCallback, useState } from 'react'
import { Link, useFocusEffect, useRouter } from 'expo-router'
import { Alert, ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ApiError, deleteTrackedDelivery, fetchTrackedDeliveries, saveTrackedDelivery } from '../src/api'
import { useSession } from '../src/context/SessionContext'
import { parseDeliveryLink } from '../src/deepLinks'
import type { PaginationMeta, TrackedDelivery } from '../src/domain'
import { deliveryStatusLabel } from '../src/trackingDisplay'

export default function TrackedScreen() {
  const router = useRouter()
  const { session } = useSession()
  const [items, setItems] = useState<TrackedDelivery[]>([])
  const [link, setLink] = useState('')
  const [label, setLabel] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [page, setPage] = useState(1)
  const [meta, setMeta] = useState<PaginationMeta | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async (currentPage = page) => {
    if (!session) return
    setLoading(true)
    setError('')
    try {
      const response = await fetchTrackedDeliveries(session.token, currentPage)
      setItems(response.data)
      setMeta(response.meta)
      setPage(response.meta.current_page)
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Não foi possível carregar seus acompanhamentos.')
    } finally {
      setLoading(false)
    }
  }, [page, session?.token])

  useFocusEffect(useCallback(() => {
    void load()
  }, [load]))

  async function add() {
    if (!session) return
    const parsed = parseDeliveryLink(link.trim())
    if (!parsed) {
      setError('Cole um link de entrega válido, com o token de acesso.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await saveTrackedDelivery({
        public_id: parsed.publicId,
        access_token: parsed.token,
        role: parsed.role,
        label: label.trim() || undefined,
      }, session.token)
      setLink('')
      setLabel('')
      await load()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Não foi possível salvar este acompanhamento.')
    } finally {
      setSaving(false)
    }
  }

  function remove(item: TrackedDelivery) {
    if (!session) return
    Alert.alert('Remover acompanhamento?', 'A entrega continuará existindo, mas deixará de aparecer na sua conta.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: () => {
          void deleteTrackedDelivery(item.id, session.token).then(() => load()).catch(() => setError('Não foi possível remover o acompanhamento.'))
        },
      },
    ])
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Link href="/(tabs)/account" style={styles.back}>← Conta</Link>
        <Text style={styles.eyebrow}>ACOMPANHAMENTOS</Text>
        <Text style={styles.title}>Entregas salvas</Text>
        <Text style={styles.description}>Guarde um link para encontrar a viagem em qualquer aparelho.</Text>

        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>Adicionar acompanhamento</Text>
          <TextInput accessibilityLabel="Link da entrega" autoCapitalize="none" autoCorrect={false} onChangeText={setLink} placeholder="Cole o link completo" style={styles.input} value={link} />
          <TextInput accessibilityLabel="Nome do acompanhamento" onChangeText={setLabel} placeholder="Nome opcional" style={styles.input} value={label} />
          <Pressable accessibilityRole="button" disabled={saving} onPress={() => void add()} style={styles.primaryButton}>
            {saving ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.primaryText}>Salvar acompanhamento</Text>}
          </Pressable>
        </View>

        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        {loading ? <ActivityIndicator color={colors.primary} style={styles.loading} /> : null}
        {!loading && items.length === 0 ? <Text style={styles.empty}>Nenhum acompanhamento salvo.</Text> : null}
        {items.map((item) => (
          <View key={item.id} style={styles.card}>
            <Text style={styles.cardTitle}>{item.label || `Para ${item.recipient_name}`}</Text>
            <Text style={styles.cardSub}>{item.origin} → {item.destination}</Text>
            <Text style={styles.cardStatus}>{deliveryStatusLabel(item.status)} · {item.progress}%</Text>
            <View style={styles.actions}>
              <Pressable onPress={() => router.push({ pathname: '/track', params: { publicId: item.public_id, fromAccount: item.role } })} style={styles.actionButton}>
                <Text style={styles.actionText}>Acompanhar</Text>
              </Pressable>
              <Pressable onPress={() => remove(item)} style={styles.actionButton}>
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
  input: { borderColor: colors.line, borderRadius: 10, borderWidth: 1, fontSize: 16, marginTop: 10, minHeight: 48, paddingHorizontal: 12 },
  primaryButton: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: 12, justifyContent: 'center', minHeight: 48, marginTop: 12 },
  primaryText: { color: '#ffffff', fontSize: 15, fontWeight: '800' },
  error: { color: '#b42318', fontSize: 14, lineHeight: 20, marginTop: 16 },
  loading: { marginVertical: 28 },
  empty: { color: colors.muted, marginTop: 24 },
  card: { backgroundColor: '#ffffff', borderColor: colors.line, borderRadius: 16, borderWidth: 1, marginTop: 12, padding: 16 },
  cardTitle: { color: colors.ink, fontSize: 17, fontWeight: '800' },
  cardSub: { color: colors.muted, fontSize: 14, marginTop: 5 },
  cardStatus: { color: colors.primary, fontSize: 13, fontWeight: '700', marginTop: 8 },
  actions: { flexDirection: 'row', gap: 16, marginTop: 12 },
  actionButton: { justifyContent: 'center', minHeight: 40 },
  actionText: { color: colors.primary, fontSize: 14, fontWeight: '700' },
  removeText: { color: '#b42318', fontSize: 14, fontWeight: '700' },
  pagination: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
  pageLabel: { color: colors.muted, fontSize: 13, fontWeight: '700' },
})
