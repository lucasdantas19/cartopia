import { colors } from '../src/theme'
import { useCallback, useState } from 'react'
import { Link, useFocusEffect } from 'expo-router'
import { Alert, ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ApiError, deleteRecipient, fetchSavedRecipients, saveRecipient, updateRecipient } from '../src/api'
import { useSession } from '../src/context/SessionContext'
import type { PaginationMeta, SavedRecipient } from '../src/domain'

export default function RecipientsScreen() {
  const { session } = useSession()
  const [recipients, setRecipients] = useState<SavedRecipient[]>([])
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [nickname, setNickname] = useState('')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [page, setPage] = useState(1)
  const [meta, setMeta] = useState<PaginationMeta | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async (currentPage = page) => {
    if (!session) return
    setLoading(true)
    setError('')
    try {
      const response = await fetchSavedRecipients(session.token, currentPage, query)
      setRecipients(response.data)
      setMeta(response.meta)
      setPage(response.meta.current_page)
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Não foi possível carregar seus destinatários.')
    } finally {
      setLoading(false)
    }
  }, [page, query, session?.token])

  useFocusEffect(useCallback(() => {
    void load()
  }, [load]))

  async function addRecipient() {
    if (!session || !name.trim()) {
      setError('Informe o nome do destinatário.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const input = { name: name.trim(), email: email.trim() || undefined, nickname: nickname.trim() || undefined }
      if (editingId) await updateRecipient(editingId, input, session.token)
      else await saveRecipient(input, session.token)
      setName('')
      setEmail('')
      setNickname('')
      setEditingId(null)
      await load()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Não foi possível salvar o destinatário.')
    } finally {
      setSaving(false)
    }
  }

  function edit(recipient: SavedRecipient) {
    setEditingId(recipient.id)
    setName(recipient.name)
    setEmail(recipient.email ?? '')
    setNickname(recipient.nickname ?? '')
  }

  function remove(recipient: SavedRecipient) {
    if (!session) return
    Alert.alert('Remover destinatário?', `“${recipient.name}” será apagado dos seus contatos salvos.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: () => {
          void deleteRecipient(recipient.id, session.token).then(() => load()).catch(() => setError('Não foi possível remover o destinatário.'))
        },
      },
    ])
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Link href="/(tabs)/account" style={styles.back}>← Conta</Link>
        <Text style={styles.eyebrow}>PREFERÊNCIAS</Text>
        <Text style={styles.title}>Destinatários</Text>
        <Text style={styles.description}>Salve pessoas para preencher novas entregas mais rapidamente.</Text>

        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>{editingId ? 'Editar destinatário' : 'Adicionar destinatário'}</Text>
          <TextInput accessibilityLabel="Nome do destinatário" onChangeText={setName} placeholder="Nome" style={styles.input} value={name} />
          <TextInput accessibilityLabel="E-mail do destinatário" autoCapitalize="none" keyboardType="email-address" onChangeText={setEmail} placeholder="E-mail (opcional)" style={styles.input} value={email} />
          <TextInput accessibilityLabel="Apelido do destinatário" onChangeText={setNickname} placeholder="Apelido (opcional)" style={styles.input} value={nickname} />
          <Pressable accessibilityRole="button" disabled={saving} onPress={() => void addRecipient()} style={styles.primaryButton}>
            {saving ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.primaryText}>{editingId ? 'Atualizar destinatário' : 'Salvar destinatário'}</Text>}
          </Pressable>
          {editingId ? (
            <Pressable onPress={() => { setEditingId(null); setName(''); setEmail(''); setNickname('') }} style={styles.cancelButton}>
              <Text style={styles.cancelText}>Cancelar edição</Text>
            </Pressable>
          ) : null}
        </View>

        <TextInput
          accessibilityLabel="Buscar destinatários"
          onChangeText={setQuery}
          onSubmitEditing={() => void load()}
          placeholder="Buscar salvos"
          returnKeyType="search"
          style={styles.search}
          value={query}
        />
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        {loading ? <ActivityIndicator color={colors.primary} style={styles.loading} /> : null}
        {!loading && recipients.length === 0 ? <Text style={styles.empty}>Nenhum destinatário salvo.</Text> : null}
        {recipients.map((recipient) => (
          <View key={recipient.id} style={styles.card}>
            <Text style={styles.cardTitle}>{recipient.nickname || recipient.name}</Text>
            {recipient.nickname ? <Text style={styles.cardSub}>{recipient.name}</Text> : null}
            {recipient.email ? <Text style={styles.cardSub}>{recipient.email}</Text> : null}
            <View style={styles.actions}>
              <Pressable onPress={() => edit(recipient)} style={styles.removeButton}>
                <Text style={styles.actionText}>Editar</Text>
              </Pressable>
              <Pressable onPress={() => remove(recipient)} style={styles.removeButton}>
                <Text style={styles.removeText}>Remover</Text>
              </Pressable>
            </View>
          </View>
        ))}
        {meta && meta.last_page > 1 ? (
          <View style={styles.pagination}>
            <Pressable disabled={page === 1} onPress={() => void load(page - 1)} style={styles.removeButton}>
              <Text style={styles.actionText}>Anterior</Text>
            </Pressable>
            <Text style={styles.pageLabel}>Página {page} de {meta.last_page}</Text>
            <Pressable disabled={page === meta.last_page} onPress={() => void load(page + 1)} style={styles.removeButton}>
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
  search: { backgroundColor: '#ffffff', borderColor: colors.line, borderRadius: 10, borderWidth: 1, fontSize: 16, marginTop: 20, minHeight: 48, paddingHorizontal: 12 },
  error: { color: '#b42318', fontSize: 14, lineHeight: 20, marginTop: 16 },
  loading: { marginVertical: 28 },
  empty: { color: colors.muted, marginTop: 24 },
  card: { backgroundColor: '#ffffff', borderColor: colors.line, borderRadius: 16, borderWidth: 1, marginTop: 12, padding: 16 },
  cardTitle: { color: colors.ink, fontSize: 17, fontWeight: '800' },
  cardSub: { color: colors.muted, fontSize: 14, marginTop: 5 },
  removeButton: { alignSelf: 'flex-start', justifyContent: 'center', marginTop: 12, minHeight: 40 },
  actions: { flexDirection: 'row', gap: 18 },
  actionText: { color: colors.primary, fontSize: 14, fontWeight: '700' },
  removeText: { color: '#b42318', fontSize: 14, fontWeight: '700' },
  cancelButton: { alignItems: 'center', justifyContent: 'center', minHeight: 42, marginTop: 6 },
  cancelText: { color: colors.muted, fontSize: 14, fontWeight: '700' },
  pagination: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
  pageLabel: { color: colors.muted, fontSize: 13, fontWeight: '700' },
})
