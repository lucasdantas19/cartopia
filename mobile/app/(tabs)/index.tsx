import { colors, displayFont } from '../../src/theme'
import { useCallback, useRef, useState } from 'react'
import { Link, useFocusEffect, useRouter } from 'expo-router'
import {
  ActivityIndicator,
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
import { deliveryProgressPercent, deliveryStatusLabel } from '../../src/trackingDisplay'
import {
  listRecentDeliveries,
  type RecentDelivery,
} from '../../src/recentDeliveries'

type ActivityCardProps = {
  delivery: AccountDelivery
  kind: 'incoming' | 'sent'
  onOpen: () => void
}

function ActivityCard({ delivery, kind, onOpen }: ActivityCardProps) {
  const title = kind === 'incoming'
    ? delivery.sender_name
      ? `De ${delivery.sender_name} para você`
      : 'Uma mensagem para você'
    : `Para ${delivery.recipient_name}`

  return (
    <View style={styles.activityCard}>
      <View style={styles.activityTopline}>
        <Text style={styles.activityStatus}>{deliveryStatusLabel(delivery.status)}</Text>
        <Text style={styles.activityProgress}>
          {deliveryProgressPercent(delivery.progress)}%
        </Text>
      </View>
      <Text style={styles.activityTitle}>{title}</Text>
      <Text numberOfLines={2} style={styles.activityRoute}>
        {delivery.origin} → {delivery.destination}
      </Text>
      <Pressable
        accessibilityLabel={`${kind === 'incoming' && delivery.status === 'DELIVERED' ? 'Abrir carta' : 'Acompanhar viagem'} ${title.toLowerCase()}`}
        accessibilityRole="button"
        onPress={onOpen}
        style={styles.activityOpen}
      >
        <Text style={styles.activityOpenText}>
          {kind === 'incoming' && delivery.status === 'DELIVERED' ? 'Abrir carta' : 'Acompanhar viagem'}
        </Text>
      </Pressable>
    </View>
  )
}

export default function HomeScreen() {
  const router = useRouter()
  const { session, loading, sessionExpired } = useSession()
  const [recent, setRecent] = useState<RecentDelivery[]>([])
  const [recentLoading, setRecentLoading] = useState(Platform.OS !== 'web')
  const [recentError, setRecentError] = useState('')
  const [sent, setSent] = useState<AccountDelivery[]>([])
  const [incoming, setIncoming] = useState<AccountDelivery[]>([])
  const [accountLoading, setAccountLoading] = useState(true)
  const [accountRefreshing, setAccountRefreshing] = useState(false)
  const [accountError, setAccountError] = useState('')
  const loadedToken = useRef<string | null>(null)
  const accountRequestId = useRef(0)

  const loadAccount = useCallback(async (showRefresh = false) => {
    if (!session) return

    const currentRequest = ++accountRequestId.current
    if (loadedToken.current !== session.token) setAccountLoading(true)
    if (showRefresh) setAccountRefreshing(true)
    setAccountError('')

    try {
      const [sentResponse, incomingResponse] = await Promise.all([
        fetchAccountDeliveries(session.token),
        fetchIncomingDeliveries(session.token),
      ])
      if (accountRequestId.current !== currentRequest) return

      setSent(sentResponse.data)
      setIncoming(incomingResponse.data)
      loadedToken.current = session.token
    } catch (caught) {
      if (accountRequestId.current === currentRequest) {
        setAccountError(caught instanceof ApiError ? caught.message : 'Não foi possível carregar suas entregas.')
      }
    } finally {
      if (accountRequestId.current === currentRequest) {
        setAccountLoading(false)
        setAccountRefreshing(false)
      }
    }
  }, [session?.token])

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

  useFocusEffect(useCallback(() => {
    void loadRecent()
  }, [loadRecent]))

  useFocusEffect(useCallback(() => {
    void loadAccount()
    return () => {
      accountRequestId.current += 1
    }
  }, [loadAccount]))

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

  if (loading) return <ActivityIndicator style={styles.centered} color="#7c3aed" />

  const firstName = session?.user.name.trim().split(/\s+/)[0] || 'por aqui'
  const showAccountContent = loadedToken.current === session?.token
  const localOnlyRecent = session && showAccountContent
    ? recent.filter((delivery) => {
      const accountDeliveries = delivery.role === 'recipient' ? incoming : sent
      return !accountDeliveries.some((item) => item.public_id === delivery.publicId)
    })
    : recent

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={session ? (
          <RefreshControl
            refreshing={accountRefreshing}
            onRefresh={() => {
              void loadAccount(true)
              void loadRecent()
            }}
            tintColor="#7c3aed"
          />
        ) : undefined}
      >
        <Text style={styles.eyebrow}>CARTOPIA</Text>
        <Text style={styles.title}>
          {session ? `Olá, ${firstName}.` : 'Toda mensagem pode virar uma aventura.'}
        </Text>
        <Text style={styles.body}>
          {session
            ? 'Suas viagens e mensagens recebidas, sempre por perto.'
            : 'Crie uma surpresa ou acompanhe uma entrega pelo link que você recebeu.'}
        </Text>

        {sessionExpired ? (
          <View style={styles.errorPanel}>
            <Text accessibilityRole="alert" style={styles.errorText}>
              Sua sessão terminou. Entre novamente para ver suas viagens e mensagens.
            </Text>
            <Link href="/auth" style={styles.retryText}>Entrar novamente</Link>
          </View>
        ) : null}

        <Link href="/create" asChild>
          <Pressable accessibilityRole="button" style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>
              {session ? 'Criar nova entrega' : 'Criar uma entrega'}
            </Text>
          </Pressable>
        </Link>
        <Link href="/track" asChild>
          <Pressable accessibilityRole="button" style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Acompanhar pelo link</Text>
          </Pressable>
        </Link>

        {session ? (
          <View style={styles.accountSection}>
            {accountError ? (
              <View style={styles.errorPanel}>
                <Text accessibilityRole="alert" style={styles.errorText}>
                  {accountError}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void loadAccount(true)}
                  style={styles.retryButton}
                >
                  <Text style={styles.retryText}>Tentar novamente</Text>
                </Pressable>
              </View>
            ) : null}

            {accountLoading ? (
              <View style={styles.accountLoadingCard}>
                <ActivityIndicator color="#7c3aed" />
                <Text style={styles.accountLoadingText}>Buscando suas viagens…</Text>
              </View>
            ) : showAccountContent ? (
              <>
                <View style={styles.overviewRow}>
                  <View style={styles.overviewCard}>
                    <Text style={styles.overviewNumber}>{incoming.length}</Text>
                    <Text style={styles.overviewLabel}>recebidas</Text>
                  </View>
                  <View style={styles.overviewCard}>
                    <Text style={styles.overviewNumber}>{sent.length}</Text>
                    <Text style={styles.overviewLabel}>envios</Text>
                  </View>
                </View>

                <View style={styles.sectionHeading}>
                  <Text style={styles.sectionTitle}>Para você</Text>
                  <Link
                    href={{ pathname: '/journeys', params: { section: 'incoming' } }}
                    style={styles.viewAll}
                  >
                    Ver todas →
                  </Link>
                </View>
                {incoming.length === 0 ? (
                  <Text style={styles.emptyText}>
                    Quando alguém enviar uma mensagem para o seu e-mail, ela aparecerá aqui.
                  </Text>
                ) : incoming.slice(0, 2).map((delivery) => (
                  <ActivityCard
                    key={delivery.public_id}
                    delivery={delivery}
                    kind="incoming"
                    onOpen={() => openIncoming(delivery.public_id)}
                  />
                ))}

                <View style={styles.sectionHeading}>
                  <Text style={styles.sectionTitle}>Seus envios</Text>
                  <Link
                    href={{ pathname: '/journeys', params: { section: 'sent' } }}
                    style={styles.viewAll}
                  >
                    Ver todos →
                  </Link>
                </View>
                {sent.length === 0 ? (
                  <Text style={styles.emptyText}>
                    Sua próxima entrega aparecerá aqui para você acompanhar.
                  </Text>
                ) : sent.slice(0, 2).map((delivery) => (
                  <ActivityCard
                    key={delivery.public_id}
                    delivery={delivery}
                    kind="sent"
                    onOpen={() => openSent(delivery.public_id)}
                  />
                ))}
              </>
            ) : null}
          </View>
        ) : null}

        {Platform.OS !== 'web' && (
          localOnlyRecent.length > 0 || recentLoading || recentError
        ) ? (
          <View style={styles.recentSection}>
            <View style={styles.sectionHeading}>
              <Text style={styles.sectionTitle}>Neste celular</Text>
              <Link
                href={{
                  pathname: '/journeys',
                  params: { section: localOnlyRecent[0]?.role === 'recipient' ? 'incoming' : 'sent' },
                }}
                style={styles.viewAll}
              >
                Ver todas →
              </Link>
            </View>
            <Text style={styles.sectionDescription}>
              As últimas cinco entregas criadas ou abertas por link ficam salvas neste aparelho.
            </Text>

            {recentLoading ? (
              <ActivityIndicator color="#7c3aed" style={styles.recentLoading} />
            ) : null}
            {recentError ? (
              <View style={styles.errorPanel}>
                <Text accessibilityRole="alert" style={styles.errorText}>{recentError}</Text>
                <Pressable accessibilityRole="button" onPress={() => void loadRecent()}>
                  <Text style={styles.retryText}>Tentar novamente</Text>
                </Pressable>
              </View>
            ) : null}
            {localOnlyRecent.slice(0, 2).map((delivery) => (
              <View key={delivery.publicId} style={styles.recentCard}>
                <Text style={styles.recentEyebrow}>
                  {delivery.role === 'recipient' ? 'CARTA RECEBIDA' : 'CARTA PARA'}
                </Text>
                <Text numberOfLines={2} style={styles.recentName}>
                  {delivery.role === 'recipient' ? `Para você, ${delivery.recipientName}` : delivery.recipientName}
                </Text>
                <Text numberOfLines={2} style={styles.recentRoute}>
                  {delivery.origin} → {delivery.destination}
                </Text>
                <Pressable
                  accessibilityLabel={`Acompanhar entrega para ${delivery.recipientName}`}
                  accessibilityRole="button"
                  onPress={() => openRecent(delivery)}
                  style={styles.openButton}
                >
                  <Text style={styles.openButtonText}>Acompanhar</Text>
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  container: {
    backgroundColor: colors.background,
    flexGrow: 1,
    padding: 24,
    paddingBottom: 44,
  },
  centered: {
    flex: 1,
  },
  eyebrow: {
    color: colors.primary,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 14,
    marginTop: 12,
  },
  title: { fontFamily: displayFont,
    color: colors.ink,
    fontSize: 34,
    fontWeight: '800',
    lineHeight: 40,
  },
  body: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 24,
    marginTop: 14,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 14,
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    alignItems: 'center',
    borderColor: colors.line,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 50,
    marginTop: 10,
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  accountSection: {
    marginTop: 28,
  },
  accountLoadingCard: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    gap: 12,
    padding: 24,
  },
  accountLoadingText: {
    color: colors.muted,
    fontSize: 15,
  },
  overviewRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 28,
  },
  overviewCard: {
    backgroundColor: '#f0eafa',
    borderRadius: 16,
    flex: 1,
    padding: 16,
  },
  overviewNumber: {
    color: colors.ink,
    fontSize: 25,
    fontWeight: '800',
  },
  overviewLabel: {
    color: colors.muted,
    fontSize: 14,
    marginTop: 3,
  },
  sectionHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
    marginTop: 8,
  },
  viewAll: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  activityCard: {
    backgroundColor: '#ffffff',
    borderColor: '#eee8f7',
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 12,
    padding: 18,
  },
  activityTopline: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  activityStatus: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  activityProgress: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '800',
  },
  activityTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '800',
    marginTop: 8,
  },
  activityRoute: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },
  activityOpen: {
    alignItems: 'center',
    borderColor: colors.line,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    marginTop: 14,
    minHeight: 44,
  },
  activityOpenText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  recentSection: {
    marginTop: 34,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: '800',
  },
  sectionDescription: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 16,
    marginTop: 5,
  },
  recentLoading: {
    marginVertical: 18,
  },
  errorPanel: {
    backgroundColor: '#fff3d6',
    borderRadius: 14,
    padding: 16,
  },
  retryButton: {
    alignSelf: 'flex-start',
    justifyContent: 'center',
    minHeight: 44,
  },
  errorText: {
    color: '#b42318',
    fontSize: 14,
    lineHeight: 20,
  },
  retryText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 12,
  },
  emptyText: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    padding: 16,
  },
  recentCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    marginBottom: 12,
    padding: 18,
  },
  recentEyebrow: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  recentName: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: '800',
    marginTop: 5,
  },
  recentRoute: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 7,
  },
  openButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 10,
    justifyContent: 'center',
    marginTop: 16,
    minHeight: 44,
  },
  openButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
})
