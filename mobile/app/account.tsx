import { useEffect, useState } from 'react'
import { Link, useRouter } from 'expo-router'
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { ApiError, fetchAccountDeliveries, fetchIncomingDeliveries, fetchIncomingDeliveryToken } from '../src/api'
import { useSession } from '../src/context/SessionContext'
import type { AccountDelivery } from '../src/domain'
import { deliveryProgressPercent } from '../src/trackingDisplay'

function statusLabel(status: AccountDelivery['status']) {
  return {
    SCHEDULED: 'Preparando a partida',
    IN_TRANSIT: 'A caminho',
    DELIVERED: 'Chegou ao destino',
  }[status]
}

function DeliveryCard({ delivery, action }: { delivery: AccountDelivery; action?: () => void }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardStatus}>{statusLabel(delivery.status)}</Text>
      <Text style={styles.cardTitle}>
        {delivery.sender_name ? `${delivery.sender_name} → ` : ''}
        {delivery.recipient_name}
      </Text>
      <Text style={styles.cardRoute}>
        {delivery.origin} → {delivery.destination}
      </Text>
      <View style={styles.progressTrack}>
        <View style={[styles.progressValue, { width: `${deliveryProgressPercent(delivery.progress)}%` }]} />
      </View>
      {action ? (
        <Pressable onPress={action} style={styles.cardButton}>
          <Text style={styles.cardButtonText}>Acompanhar viagem</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

export default function AccountScreen() {
  const router = useRouter()
  const { session, signOut } = useSession()
  const [deliveries, setDeliveries] = useState<AccountDelivery[]>([])
  const [incoming, setIncoming] = useState<AccountDelivery[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [openingId, setOpeningId] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function loadAccount(showRefresh = false) {
    if (!session) return
    if (showRefresh) setRefreshing(true)
    else setLoading(true)
    setError('')

    try {
      const [sentResponse, incomingResponse] = await Promise.all([
        fetchAccountDeliveries(session.token),
        fetchIncomingDeliveries(session.token),
      ])
      setDeliveries(sentResponse.data)
      setIncoming(incomingResponse.data)
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Não foi possível carregar sua conta.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    void loadAccount()
  }, [session])

  async function openIncoming(publicId: string) {
    if (!session) return
    setOpeningId(publicId)
    try {
      const response = await fetchIncomingDeliveryToken(publicId, session.token)
      router.push({
        pathname: '/track',
        params: { publicId: response.data.public_id, token: response.data.access_token },
      })
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Não foi possível abrir esta entrega.')
    } finally {
      setOpeningId(null)
    }
  }

  async function exit() {
    await signOut()
    router.replace('/')
  }

  if (loading) return <ActivityIndicator style={styles.centered} color="#7c3aed" />

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void loadAccount(true)}
          tintColor="#7c3aed"
        />
      }
    >
      <Link href="/" style={styles.back}>← Início</Link>
      <Text style={styles.eyebrow}>MINHA CONTA</Text>
      <Text style={styles.title}>Olá, {session?.user.name}.</Text>
      <Text style={styles.email}>{session?.user.email}</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Text style={styles.sectionTitle}>Entregas recebidas</Text>
      {incoming.length === 0 ? (
        <Text style={styles.empty}>Ainda não há entregas associadas ao seu e-mail.</Text>
      ) : (
        incoming.map((delivery) => (
          <DeliveryCard
            key={delivery.public_id}
            delivery={delivery}
            action={openingId === delivery.public_id ? undefined : () => void openIncoming(delivery.public_id)}
          />
        ))
      )}

      <Text style={styles.sectionTitle}>Meus envios</Text>
      {deliveries.length === 0 ? (
        <Text style={styles.empty}>Você ainda não criou uma entrega pela sua conta.</Text>
      ) : (
        deliveries.map((delivery) => <DeliveryCard key={delivery.public_id} delivery={delivery} />)
      )}

      <Pressable onPress={() => void exit()} style={styles.button}>
        <Text style={styles.buttonText}>Sair da conta</Text>
      </Pressable>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#fffaf4', flexGrow: 1, padding: 28, paddingTop: 70 },
  centered: { flex: 1 },
  back: { color: '#7c3aed', fontSize: 16, marginBottom: 42 },
  eyebrow: { color: '#7c3aed', fontWeight: '800', letterSpacing: 2, marginBottom: 12 },
  title: { color: '#241b35', fontSize: 32, fontWeight: '800' },
  email: { color: '#665d70', fontSize: 16, marginTop: 8 },
  error: { color: '#b42318', fontSize: 15, lineHeight: 22, marginTop: 20 },
  sectionTitle: { color: '#241b35', fontSize: 22, fontWeight: '800', marginBottom: 14, marginTop: 34 },
  empty: { color: '#665d70', fontSize: 16, lineHeight: 24 },
  card: { backgroundColor: '#ffffff', borderRadius: 18, marginBottom: 14, padding: 18 },
  cardStatus: { color: '#7c3aed', fontSize: 13, fontWeight: '800', marginBottom: 8 },
  cardTitle: { color: '#241b35', fontSize: 19, fontWeight: '800' },
  cardRoute: { color: '#665d70', fontSize: 15, marginTop: 8 },
  progressTrack: { backgroundColor: '#eee8f7', borderRadius: 99, height: 7, marginTop: 16, overflow: 'hidden' },
  progressValue: { backgroundColor: '#7c3aed', borderRadius: 99, height: 7 },
  cardButton: { alignItems: 'center', borderColor: '#e5dcef', borderRadius: 10, borderWidth: 1, marginTop: 16, padding: 12 },
  cardButtonText: { color: '#7c3aed', fontWeight: '700' },
  button: { alignItems: 'center', borderColor: '#e5dcef', borderRadius: 12, borderWidth: 1, marginTop: 34, padding: 16 },
  buttonText: { color: '#7c3aed', fontSize: 16, fontWeight: '700' },
})
