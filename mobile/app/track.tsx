import { useEffect, useRef, useState } from 'react'
import { Link, useLocalSearchParams, useRouter } from 'expo-router'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import * as Linking from 'expo-linking'
import { ApiError, fetchDelivery, openDeliveryMessage } from '../src/api'
import { parseDeliveryLink } from '../src/deepLinks'
import type { Delivery } from '../src/domain'

export default function TrackScreen() {
  const params = useLocalSearchParams<{ publicId?: string; token?: string }>()
  const router = useRouter()
  const [link, setLink] = useState('')
  const [delivery, setDelivery] = useState<Delivery | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [messageError, setMessageError] = useState('')
  const [openingMessage, setOpeningMessage] = useState(false)
  const [loading, setLoading] = useState(false)
  const requestId = useRef(0)
  const messageRequestId = useRef(0)

  useEffect(() => {
    const publicId = typeof params.publicId === 'string' ? params.publicId : undefined
    const token = typeof params.token === 'string' ? params.token : undefined
    requestId.current += 1
    messageRequestId.current += 1
    setDelivery(null)
    setMessage(null)
    setMessageError('')
    setOpeningMessage(false)
    setError('')
    setLoading(false)

    if (publicId && token) void load(publicId, token, true)
  }, [params.publicId, params.token])

  useEffect(() => () => {
    requestId.current += 1
    messageRequestId.current += 1
  }, [])

  useEffect(() => {
    const publicId = typeof params.publicId === 'string' ? params.publicId : undefined
    const token = typeof params.token === 'string' ? params.token : undefined
    if (!publicId || !token || delivery?.status === 'DELIVERED') return

    const refresh = setInterval(() => {
      void load(publicId, token)
    }, 30000)

    return () => clearInterval(refresh)
  }, [delivery?.status, params.publicId, params.token])

  useEffect(() => {
    const subscription = Linking.addEventListener('url', ({ url }) => {
      const parsed = parseDeliveryLink(url)
      if (parsed) router.setParams({ publicId: parsed.publicId, token: parsed.token })
    })

    return () => subscription.remove()
  }, [router])

  async function load(publicId: string, token: string, showLoading = false) {
    const currentRequest = ++requestId.current
    if (showLoading) setLoading(true)
    setError('')
    try {
      const response = await fetchDelivery(publicId, token)
      if (requestId.current === currentRequest) setDelivery(response.data)
    } catch (caught) {
      if (requestId.current === currentRequest) {
        setError(caught instanceof ApiError ? caught.message : 'Não foi possível carregar esta entrega.')
      }
    } finally {
      if (requestId.current === currentRequest && showLoading) setLoading(false)
    }
  }

  function submit() {
    const parsed = parseDeliveryLink(link.trim())
    if (!parsed) {
      setError('Cole o link original de acompanhamento da entrega.')
      return
    }
    router.setParams({ publicId: parsed.publicId, token: parsed.token })
  }

  async function revealMessage() {
    const publicId = typeof params.publicId === 'string' ? params.publicId : undefined
    const token = typeof params.token === 'string' ? params.token : undefined
    if (!publicId || !token) return

    const currentRequest = ++messageRequestId.current
    setOpeningMessage(true)
    setMessageError('')
    try {
      const response = await openDeliveryMessage(publicId, token)
      if (messageRequestId.current === currentRequest) setMessage(response.data.message)
    } catch (caught) {
      if (messageRequestId.current === currentRequest) {
        setMessageError(caught instanceof ApiError ? caught.message : 'Não foi possível abrir a mensagem agora.')
      }
    } finally {
      if (messageRequestId.current === currentRequest) setOpeningMessage(false)
    }
  }

  if (loading) return <ActivityIndicator style={styles.centered} color="#7c3aed" />

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Link href="/" style={styles.back}>← Voltar</Link>
      <Text style={styles.title}>Acompanhar entrega</Text>
      {!delivery ? (
        <>
          <Text style={styles.body}>Cole aqui o link recebido para abrir a viagem, sem precisar entrar na sua conta.</Text>
          <TextInput autoCapitalize="none" autoCorrect={false} placeholder="https://.../d/...#token=..." value={link} onChangeText={setLink} style={styles.input} />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable onPress={submit} style={styles.button}>
            <Text style={styles.buttonText}>Abrir viagem</Text>
          </Pressable>
          {error && params.publicId && params.token ? (
            <Pressable
              onPress={() => void load(String(params.publicId), String(params.token), true)}
              style={styles.retryButton}
            >
              <Text style={styles.retryButtonText}>Tentar novamente</Text>
            </Pressable>
          ) : null}
        </>
      ) : (
        <>
          {error ? (
            <View style={styles.refreshError}>
              <Text style={styles.error}>{error}</Text>
              <Pressable onPress={() => void load(String(params.publicId), String(params.token))}>
                <Text style={styles.retryButtonText}>Tentar novamente</Text>
              </Pressable>
            </View>
          ) : null}
          <View style={styles.card}>
            <Text style={styles.status}>{delivery.status === 'DELIVERED' ? 'Chegou ao destino' : 'A caminho'}</Text>
            <Text style={styles.recipient}>{delivery.recipient_name}</Text>
            <Text style={styles.body}>{delivery.sender_name ? `${delivery.sender_name} preparou uma surpresa para você.` : 'Uma surpresa está a caminho.'}</Text>
            <Text style={styles.route}>{delivery.origin} → {delivery.destination}</Text>
            <Text style={styles.progress}>{Math.round(delivery.progress * 100)}% da jornada</Text>
          </View>
          {delivery.access_role === 'recipient' && delivery.status !== 'DELIVERED' && !message ? (
            <View style={styles.waitingCard}>
              <Text style={styles.waitingTitle}>A mensagem está viajando.</Text>
              <Text style={styles.waitingBody}>
                Ela será liberada assim que a entrega chegar ao destino. O acompanhamento é atualizado automaticamente.
              </Text>
            </View>
          ) : null}
          {delivery.access_role === 'recipient' && delivery.status === 'DELIVERED' && !message ? (
            <View style={styles.revealCard}>
              <Text style={styles.revealTitle}>A carta chegou.</Text>
              <Text style={styles.revealBody}>A surpresa está pronta para ser aberta.</Text>
              <Pressable disabled={openingMessage} onPress={() => void revealMessage()} style={styles.button}>
                {openingMessage ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Abrir mensagem</Text>}
              </Pressable>
              {messageError ? <Text style={styles.error}>{messageError}</Text> : null}
            </View>
          ) : null}
          {message ? (
            <View style={styles.messageCard}>
              <Text style={styles.messageEyebrow}>SUA CARTA</Text>
              <Text style={styles.messageText}>{message}</Text>
            </View>
          ) : null}
        </>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#fffaf4', flexGrow: 1, padding: 28, paddingTop: 70 },
  centered: { flex: 1 },
  back: { color: '#7c3aed', fontSize: 16, marginBottom: 48 },
  title: { color: '#241b35', fontSize: 32, fontWeight: '800', marginBottom: 16 },
  body: { color: '#665d70', fontSize: 16, lineHeight: 24, marginBottom: 24 },
  input: { backgroundColor: '#ffffff', borderColor: '#e5dcef', borderRadius: 12, borderWidth: 1, fontSize: 15, marginBottom: 12, padding: 16 },
  error: { color: '#b42318', marginBottom: 12 },
  button: { alignItems: 'center', backgroundColor: '#7c3aed', borderRadius: 12, padding: 16 },
  buttonText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  retryButton: { alignItems: 'center', marginTop: 18, padding: 12 },
  retryButtonText: { color: '#7c3aed', fontSize: 15, fontWeight: '700' },
  refreshError: { backgroundColor: '#fff3d6', borderRadius: 12, marginBottom: 16, padding: 16 },
  card: { backgroundColor: '#ffffff', borderRadius: 20, padding: 22 },
  status: { color: '#7c3aed', fontSize: 14, fontWeight: '800', marginBottom: 14 },
  recipient: { color: '#241b35', fontSize: 28, fontWeight: '800', marginBottom: 8 },
  route: { color: '#241b35', fontSize: 16, fontWeight: '700', marginTop: 8 },
  progress: { color: '#665d70', marginTop: 18 },
  revealCard: { backgroundColor: '#f1ebff', borderRadius: 20, marginTop: 16, padding: 22 },
  revealTitle: { color: '#241b35', fontSize: 23, fontWeight: '800' },
  revealBody: { color: '#665d70', fontSize: 16, lineHeight: 24, marginBottom: 20, marginTop: 8 },
  waitingCard: { backgroundColor: '#fff3d6', borderRadius: 20, marginTop: 16, padding: 22 },
  waitingTitle: { color: '#6d4b00', fontSize: 20, fontWeight: '800' },
  waitingBody: { color: '#80631d', fontSize: 15, lineHeight: 23, marginTop: 8 },
  messageCard: { backgroundColor: '#ffffff', borderColor: '#e5dcef', borderRadius: 20, borderWidth: 1, marginTop: 16, padding: 24 },
  messageEyebrow: { color: '#7c3aed', fontSize: 12, fontWeight: '800', letterSpacing: 1.5, marginBottom: 16 },
  messageText: { color: '#241b35', fontSize: 20, lineHeight: 30 },
})
