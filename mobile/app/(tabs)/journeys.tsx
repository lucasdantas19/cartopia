import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import {
  ApiError,
  fetchAccountDeliveries,
  fetchIncomingDeliveries,
} from '../../src/api'
import { useSession } from '../../src/context/SessionContext'
import type { AccountDelivery } from '../../src/domain'
import {
  arrivalLabel,
  deliveryProgressPercent,
  deliveryStatusLabel,
} from '../../src/trackingDisplay'
import {
  listRecentDeliveries,
  removeRecentDelivery,
  type RecentDelivery,
} from '../../src/recentDeliveries'

type DeliveryCardProps = {
  delivery: AccountDelivery
  kind: 'incoming' | 'sent'
  onOpen: () => void
}

function DeliveryCard({ delivery, kind, onOpen }: DeliveryCardProps) {
  const progress = deliveryProgressPercent(delivery.progress)
  const arrival = arrivalLabel(delivery.arrives_at)
  const title = kind === 'incoming'
    ? delivery.sender_name
      ? `De ${delivery.sender_name} para você`
      : 'Uma mensagem para você'
    : `Para ${delivery.recipient_name}`

  return (
    <View style={styles.card}>
      <Text style={styles.cardStatus}>{deliveryStatusLabel(delivery.status)}</Text>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardRoute}>
        {delivery.origin} → {delivery.destination}
      </Text>
      <View style={styles.progressHeading}>
        <Text style={styles.progressLabel}>Progresso da viagem</Text>
        <Text style={styles.progressPercent}>{progress}%</Text>
      </View>
      <View
        accessibilityLabel="Progresso da viagem"
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: progress }}
        style={styles.progressTrack}
      >
        <View style={[styles.progressValue, { width: `${progress}%` }]} />
      </View>
      {arrival ? (
        <Text style={styles.arrival}>
          {delivery.status === 'DELIVERED' ? 'Chegou em ' : 'Chegada prevista: '}
          {arrival}
        </Text>
      ) : null}
      <Pressable
        accessibilityLabel={`Acompanhar viagem ${title.toLowerCase()}`}
        accessibilityRole="button"
        onPress={onOpen}
        style={styles.cardButton}
      >
        <Text style={styles.cardButtonText}>Acompanhar viagem</Text>
      </Pressable>
    </View>
  )
}

type LocalDeliveriesProps = {
  deliveries: RecentDelivery[]
  onOpen: (delivery: RecentDelivery) => void
  onRemove: (delivery: RecentDelivery) => void
}

function LocalDeliveries({ deliveries, onOpen, onRemove }: LocalDeliveriesProps) {
  if (Platform.OS === 'web' || deliveries.length === 0) return null

  return (
    <View style={styles.localSection}>
      <Text style={styles.localTitle}>Salvas neste celular</Text>
      <Text style={styles.localDescription}>
        Estas viagens ficam disponíveis neste aparelho mesmo depois de fechar o aplicativo.
      </Text>
      {deliveries.map((delivery) => (
        <View key={delivery.publicId} style={styles.localCard}>
          <Text style={styles.cardTitle}>Para {delivery.recipientName}</Text>
          <Text style={styles.cardRoute}>
            {delivery.origin} → {delivery.destination}
          </Text>
          <View style={styles.localActions}>
            <Pressable
              accessibilityLabel={`Acompanhar entrega para ${delivery.recipientName}`}
              accessibilityRole="button"
              onPress={() => onOpen(delivery)}
              style={styles.localOpenButton}
            >
              <Text style={styles.localOpenText}>Acompanhar</Text>
            </Pressable>
            <Pressable
              accessibilityLabel={`Remover entrega para ${delivery.recipientName} deste celular`}
              accessibilityRole="button"
              onPress={() => onRemove(delivery)}
              style={styles.localRemoveButton}
            >
              <Text style={styles.localRemoveText}>Remover</Text>
            </Pressable>
          </View>
        </View>
      ))}
    </View>
  )
}

export default function JourneysScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ section?: string }>()
  const { session, loading: sessionLoading, sessionExpired } = useSession()
  const [selected, setSelected] = useState<'incoming' | 'sent'>('incoming')
  const [deliveries, setDeliveries] = useState<AccountDelivery[]>([])
  const [incoming, setIncoming] = useState<AccountDelivery[]>([])
  const [recent, setRecent] = useState<RecentDelivery[]>([])
  const [recentLoading, setRecentLoading] = useState(Platform.OS !== 'web')
  const [recentError, setRecentError] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const loadedToken = useRef<string | null>(null)
  const requestId = useRef(0)

  useEffect(() => {
    if (params.section === 'incoming' || params.section === 'sent') {
      setSelected(params.section)
    } else if (!sessionLoading) {
      setSelected(session ? 'incoming' : 'sent')
    }
  }, [params.section, sessionLoading, session?.token])

  const loadRecent = useCallback(async () => {
    if (Platform.OS === 'web') return

    setRecentLoading(true)
    setRecentError('')
    try {
      setRecent(await listRecentDeliveries())
    } catch {
      setRecentError('Não foi possível carregar as entregas salvas neste celular.')
    } finally {
      setRecentLoading(false)
    }
  }, [])

  const loadAccount = useCallback(async (showRefresh = false) => {
    if (!session) return

    const currentRequest = ++requestId.current
    if (loadedToken.current !== session.token) setLoading(true)
    if (showRefresh) setRefreshing(true)
    setError('')

    try {
      const [sentResponse, incomingResponse] = await Promise.all([
        fetchAccountDeliveries(session.token),
        fetchIncomingDeliveries(session.token),
      ])
      if (requestId.current !== currentRequest) return

      setDeliveries(sentResponse.data)
      setIncoming(incomingResponse.data)
      loadedToken.current = session.token
    } catch (caught) {
      if (requestId.current === currentRequest) {
        setError(caught instanceof ApiError ? caught.message : 'Não foi possível carregar sua conta.')
      }
    } finally {
      if (requestId.current === currentRequest) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [session?.token])

  useFocusEffect(useCallback(() => {
    void loadAccount()
    return () => {
      requestId.current += 1
    }
  }, [loadAccount]))

  useFocusEffect(useCallback(() => {
    void loadRecent()
  }, [loadRecent]))

  function openIncoming(publicId: string) {
    router.push({
      pathname: '/track',
      params: { publicId, fromAccount: 'recipient' },
    })
  }

  function openSent(publicId: string) {
    router.push({
      pathname: '/track',
      params: { publicId, fromAccount: 'sender' },
    })
  }

  function openRecent(delivery: RecentDelivery) {
    router.push({
      pathname: '/track',
      params: { publicId: delivery.publicId, token: delivery.accessToken },
    })
  }

  function confirmRemoval(delivery: RecentDelivery) {
    Alert.alert(
      'Remover deste celular?',
      'O acesso salvo a esta entrega será apagado. Guarde o link para abri-la depois.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: () => {
            void removeRecentDelivery(delivery.publicId)
              .then(() => setRecent((items) => items.filter((item) => item.publicId !== delivery.publicId)))
              .catch(() => setRecentError('Não foi possível remover esta entrega do celular.'))
          },
        },
      ],
    )
  }

  const showContent = loadedToken.current === session?.token
  const localOnlyRecent = session && showContent
    ? recent.filter((item) => {
      const accountDeliveries = item.role === 'recipient' ? incoming : deliveries
      return !accountDeliveries.some((delivery) => delivery.public_id === item.publicId)
    })
    : recent
  const localIncoming = localOnlyRecent.filter((item) => item.role === 'recipient')
  const localSent = localOnlyRecent.filter((item) => item.role === 'sender')

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={session ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              void loadAccount(true)
              void loadRecent()
            }}
            tintColor="#7c3aed"
          />
        ) : undefined}
      >
        <Text style={styles.eyebrow}>SUAS AVENTURAS</Text>
        <Text style={styles.title}>Viagens</Text>
        <Text style={styles.intro}>
          Acompanhe as mensagens que chegaram e as cartas que você enviou.
        </Text>

        {sessionExpired ? (
          <View style={styles.errorPanel}>
            <Text accessibilityRole="alert" style={styles.error}>
              Sua sessão terminou. Entre novamente para ver suas viagens e mensagens.
            </Text>
            <Link href="/auth" style={styles.retryText}>Entrar novamente</Link>
          </View>
        ) : null}

        <View accessibilityRole="tablist" style={styles.segment}>
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: selected === 'incoming' }}
            onPress={() => setSelected('incoming')}
            style={[styles.segmentButton, selected === 'incoming' && styles.segmentSelected]}
          >
            <Text style={[styles.segmentText, selected === 'incoming' && styles.segmentTextSelected]}>
              Recebidas ({(session && showContent ? incoming.length : 0) + localIncoming.length})
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: selected === 'sent' }}
            onPress={() => setSelected('sent')}
            style={[styles.segmentButton, selected === 'sent' && styles.segmentSelected]}
          >
            <Text style={[styles.segmentText, selected === 'sent' && styles.segmentTextSelected]}>
              Enviadas ({(session && showContent ? deliveries.length : 0) + localSent.length})
            </Text>
          </Pressable>
        </View>

        {selected === 'incoming' ? (
          <>
            {sessionLoading ? (
              <ActivityIndicator color="#7c3aed" style={styles.loading} />
            ) : !session ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>
                  {sessionExpired ? 'Sua sessão terminou' : 'Entre para ver suas mensagens'}
                </Text>
                <Text style={styles.empty}>
                  {sessionExpired
                    ? 'Entre novamente para ver as mensagens enviadas ao seu e-mail.'
                    : 'As entregas enviadas para o seu e-mail aparecem aqui depois que você entra.'}
                </Text>
                <Link href="/auth" asChild>
                  <Pressable accessibilityRole="button" style={styles.primaryButton}>
                    <Text style={styles.primaryButtonText}>Entrar ou criar conta</Text>
                  </Pressable>
                </Link>
              </View>
            ) : (
              <>
                {error ? (
                  <View style={styles.errorPanel}>
                    <Text accessibilityRole="alert" style={styles.error}>{error}</Text>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => void loadAccount(true)}
                      style={styles.retryButton}
                    >
                      <Text style={styles.retryText}>Tentar novamente</Text>
                    </Pressable>
                  </View>
                ) : null}
                {loading ? (
                  <ActivityIndicator color="#7c3aed" style={styles.loading} />
                ) : showContent && incoming.length === 0 && localIncoming.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <Text style={styles.emptyTitle}>Nenhuma entrega por aqui ainda</Text>
                    <Text style={styles.empty}>
                      Mensagens enviadas para o seu e-mail aparecerão aqui.
                    </Text>
                  </View>
                ) : showContent ? incoming.map((delivery) => (
                  <DeliveryCard
                    key={delivery.public_id}
                    delivery={delivery}
                    kind="incoming"
                    onOpen={() => openIncoming(delivery.public_id)}
                  />
                )) : null}
              </>
            )}
            <LocalDeliveries
              deliveries={localIncoming}
              onOpen={openRecent}
              onRemove={confirmRemoval}
            />
            <Link href="/track" asChild>
              <Pressable accessibilityRole="button" style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Acompanhar pelo link</Text>
              </Pressable>
            </Link>
          </>
        ) : (
          <>
            {session && error ? (
              <View style={styles.errorPanel}>
                <Text accessibilityRole="alert" style={styles.error}>{error}</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void loadAccount(true)}
                  style={styles.retryButton}
                >
                  <Text style={styles.retryText}>Tentar novamente</Text>
                </Pressable>
              </View>
            ) : null}
            {session && loading ? (
              <ActivityIndicator color="#7c3aed" style={styles.loading} />
            ) : session && showContent ? deliveries.map((delivery) => (
              <DeliveryCard
                key={delivery.public_id}
                delivery={delivery}
                kind="sent"
                onOpen={() => openSent(delivery.public_id)}
              />
            )) : null}

            <LocalDeliveries
              deliveries={localSent}
              onOpen={openRecent}
              onRemove={confirmRemoval}
            />
            {!sessionLoading && !loading && !error && showContent && deliveries.length === 0
              && !recentLoading && localSent.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyTitle}>Sua próxima aventura começa aqui</Text>
                  <Text style={styles.empty}>
                    Crie uma entrega para acompanhar sua viagem.
                  </Text>
                </View>
              ) : null}
            {!sessionLoading && !session && !recentLoading && !recentError
              && localSent.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyTitle}>Nenhuma viagem salva neste celular</Text>
                  <Text style={styles.empty}>
                    As entregas que você criar ou abrir por link poderão ser acompanhadas depois.
                  </Text>
                </View>
              ) : null}
            <Link href="/create" asChild>
              <Pressable accessibilityRole="button" style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>Criar uma entrega</Text>
              </Pressable>
            </Link>
          </>
        )}
        {recentLoading ? <ActivityIndicator color="#7c3aed" style={styles.loading} /> : null}
        {recentError ? (
          <View style={styles.errorPanel}>
            <Text accessibilityRole="alert" style={styles.error}>{recentError}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => void loadRecent()}
              style={styles.retryButton}
            >
              <Text style={styles.retryText}>Tentar novamente</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: '#fffaf4', flex: 1 },
  container: { backgroundColor: '#fffaf4', flexGrow: 1, padding: 24, paddingBottom: 32 },
  eyebrow: { color: '#7c3aed', fontWeight: '800', letterSpacing: 2, marginBottom: 10 },
  title: { color: '#241b35', fontSize: 32, fontWeight: '800', lineHeight: 38 },
  intro: { color: '#665d70', fontSize: 15, lineHeight: 22, marginTop: 8 },
  segment: {
    backgroundColor: '#eee8f7',
    borderRadius: 14,
    flexDirection: 'row',
    gap: 4,
    marginBottom: 20,
    marginTop: 24,
    padding: 4,
  },
  segmentButton: {
    alignItems: 'center',
    borderRadius: 10,
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
  },
  segmentSelected: { backgroundColor: '#ffffff' },
  segmentText: { color: '#665d70', fontSize: 14, fontWeight: '700' },
  segmentTextSelected: { color: '#7c3aed' },
  loading: { marginVertical: 32 },
  card: {
    backgroundColor: '#ffffff',
    borderColor: '#eee8f7',
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 14,
    padding: 18,
  },
  cardStatus: { color: '#7c3aed', fontSize: 13, fontWeight: '800', marginBottom: 8 },
  cardTitle: { color: '#241b35', fontSize: 19, fontWeight: '800' },
  cardRoute: { color: '#665d70', fontSize: 15, lineHeight: 21, marginTop: 8 },
  progressHeading: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  progressLabel: { color: '#665d70', fontSize: 13 },
  progressPercent: { color: '#241b35', fontSize: 13, fontWeight: '800' },
  progressTrack: {
    backgroundColor: '#eee8f7',
    borderRadius: 99,
    height: 7,
    marginTop: 8,
    overflow: 'hidden',
  },
  progressValue: { backgroundColor: '#7c3aed', borderRadius: 99, height: 7 },
  arrival: { color: '#665d70', fontSize: 13, marginTop: 12 },
  cardButton: {
    alignItems: 'center',
    borderColor: '#e5dcef',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: 16,
    minHeight: 48,
    paddingHorizontal: 12,
  },
  cardButtonText: { color: '#7c3aed', fontSize: 15, fontWeight: '700' },
  emptyCard: {
    backgroundColor: '#ffffff',
    borderColor: '#e5dcef',
    borderRadius: 18,
    borderWidth: 1,
    padding: 20,
  },
  emptyTitle: { color: '#241b35', fontSize: 17, fontWeight: '800', marginBottom: 6 },
  empty: { color: '#665d70', fontSize: 15, lineHeight: 22 },
  errorPanel: { backgroundColor: '#fff1ef', borderRadius: 14, marginTop: 20, padding: 16 },
  error: { color: '#b42318', fontSize: 15, lineHeight: 22 },
  retryButton: { alignSelf: 'flex-start', justifyContent: 'center', marginTop: 10, minHeight: 44 },
  retryText: { color: '#7c3aed', fontSize: 15, fontWeight: '800' },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#7c3aed',
    borderRadius: 12,
    justifyContent: 'center',
    marginTop: 18,
    minHeight: 48,
    paddingHorizontal: 18,
  },
  primaryButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '800' },
  secondaryButton: {
    alignItems: 'center',
    borderColor: '#e5dcef',
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    marginTop: 18,
    minHeight: 48,
  },
  secondaryButtonText: { color: '#7c3aed', fontSize: 15, fontWeight: '700' },
  localSection: { marginTop: 18 },
  localTitle: { color: '#241b35', fontSize: 20, fontWeight: '800' },
  localDescription: { color: '#665d70', fontSize: 14, lineHeight: 20, marginBottom: 14, marginTop: 6 },
  localCard: {
    backgroundColor: '#ffffff',
    borderColor: '#eee8f7',
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 12,
    padding: 18,
  },
  localActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
  },
  localOpenButton: {
    alignItems: 'center',
    backgroundColor: '#7c3aed',
    borderRadius: 10,
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
  },
  localOpenText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  localRemoveButton: { justifyContent: 'center', minHeight: 44 },
  localRemoveText: { color: '#665d70', fontSize: 14, fontWeight: '700' },
})
