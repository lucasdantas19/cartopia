import { useEffect, useRef, useState } from 'react'
import * as Clipboard from 'expo-clipboard'
import { Link, useLocalSearchParams, useRouter } from 'expo-router'
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import * as Linking from 'expo-linking'
import { ApiError, fetchDelivery, fetchRecipientShareLink, openDeliveryMessage } from '../src/api'
import { createDeliveryShareUrl, parseDeliveryLink, previewDeliveryShareUrl } from '../src/deepLinks'
import { webUrl } from '../src/config'
import type { Delivery } from '../src/domain'
import { DeliveryJourneyMap } from '../src/components/DeliveryJourneyMap'
import { arrivalLabel, deliveryProgressPercent, deliveryStatusLabel } from '../src/trackingDisplay'
import { deliveryMapRoute } from '../src/trackingMap'

const couriers = {
  'paper-swallow': {
    name: 'Andorinha de Papel',
    image: require('../assets/couriers/paper-swallow-icon.png'),
  },
  'postal-cat': {
    name: 'Gatinho Carteiro',
    image: require('../assets/couriers/postal-cat-icon.png'),
  },
  'little-dragon': {
    name: 'Dragão Mensageiro',
    image: require('../assets/couriers/little-dragon-icon.png'),
  },
}

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
  const [refreshing, setRefreshing] = useState(false)
  const [viewMode, setViewMode] = useState<'progress' | 'map'>('progress')
  const [fetchedAt, setFetchedAt] = useState(Date.now())
  const [recipientShareUrl, setRecipientShareUrl] = useState<string | null>(null)
  const [shareLinkLoading, setShareLinkLoading] = useState(false)
  const [shareLinkError, setShareLinkError] = useState('')
  const [copyingShareLink, setCopyingShareLink] = useState(false)
  const [shareLinkCopied, setShareLinkCopied] = useState(false)
  const [showFullShareLink, setShowFullShareLink] = useState(false)
  const requestId = useRef(0)
  const messageRequestId = useRef(0)
  const shareRequestId = useRef(0)

  useEffect(() => {
    const publicId = typeof params.publicId === 'string' ? params.publicId : undefined
    const token = typeof params.token === 'string' ? params.token : undefined
    requestId.current += 1
    messageRequestId.current += 1
    shareRequestId.current += 1
    setDelivery(null)
    setMessage(null)
    setMessageError('')
    setOpeningMessage(false)
    setError('')
    setLoading(false)
    setRefreshing(false)
    setViewMode('progress')
    setRecipientShareUrl(null)
    setShareLinkLoading(false)
    setShareLinkError('')
    setCopyingShareLink(false)
    setShareLinkCopied(false)
    setShowFullShareLink(false)

    if (publicId && token) void load(publicId, token, true)
  }, [params.publicId, params.token])

  useEffect(() => () => {
    requestId.current += 1
    messageRequestId.current += 1
    shareRequestId.current += 1
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

  async function load(publicId: string, token: string, showLoading = false, showRefreshing = false) {
    const currentRequest = ++requestId.current
    if (showLoading) setLoading(true)
    if (showRefreshing) setRefreshing(true)
    setError('')
    try {
      const response = await fetchDelivery(publicId, token)
      if (requestId.current === currentRequest) {
        setDelivery(response.data)
        setFetchedAt(Date.now())
      }
    } catch (caught) {
      if (requestId.current === currentRequest) {
        setError(caught instanceof ApiError ? caught.message : 'Não foi possível carregar esta entrega.')
      }
    } finally {
      if (requestId.current === currentRequest) {
        setLoading(false)
        setRefreshing(false)
      }
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

  async function loadRecipientShareLink() {
    const publicId = typeof params.publicId === 'string' ? params.publicId : undefined
    const senderToken = typeof params.token === 'string' ? params.token : undefined
    if (!publicId || !senderToken || delivery?.access_role !== 'sender') return

    const currentRequest = ++shareRequestId.current
    setShareLinkLoading(true)
    setShareLinkError('')

    try {
      const response = await fetchRecipientShareLink(publicId, senderToken)
      const url = createDeliveryShareUrl(
        webUrl,
        response.data.public_id,
        response.data.recipient_access_token,
        'recipient',
      )
      if (!url) throw new Error('Web URL unavailable')
      if (shareRequestId.current === currentRequest) setRecipientShareUrl(url)
    } catch (caught) {
      if (shareRequestId.current === currentRequest) {
        let message = 'Não foi possível preparar o link. Confira o endereço web configurado e tente novamente.'
        if (caught instanceof ApiError) {
          message = caught.code === 'SHARE_LINK_UNAVAILABLE'
            ? 'O link desta entrega não está disponível para recuperação.'
            : caught.message
        }
        setShareLinkError(message)
      }
    } finally {
      if (shareRequestId.current === currentRequest) setShareLinkLoading(false)
    }
  }

  async function copyRecipientShareLink() {
    if (!recipientShareUrl) return

    setCopyingShareLink(true)
    setShareLinkCopied(false)
    setShareLinkError('')
    try {
      const copied = await Clipboard.setStringAsync(recipientShareUrl)
      if (!copied) throw new Error('Clipboard unavailable')
      setShareLinkCopied(true)
    } catch {
      setShareLinkError('Não foi possível copiar automaticamente. Abra o link completo para selecionar e copiar.')
      setShowFullShareLink(true)
    } finally {
      setCopyingShareLink(false)
    }
  }

  async function shareRecipientShareLink() {
    if (!recipientShareUrl) return

    setShareLinkError('')
    try {
      await Share.share({ message: recipientShareUrl })
    } catch {
      setShareLinkError('Não foi possível compartilhar agora. Copie o link ou abra a versão completa abaixo.')
    }
  }

  function refresh() {
    const publicId = typeof params.publicId === 'string' ? params.publicId : undefined
    const token = typeof params.token === 'string' ? params.token : undefined
    if (publicId && token) void load(publicId, token, false, true)
  }

  const progress = delivery ? deliveryProgressPercent(delivery.progress) : 0
  const courier = delivery ? couriers[delivery.courier as keyof typeof couriers] : undefined
  const arrival = delivery ? arrivalLabel(delivery.arrives_at) : null
  const mapAvailable = Platform.OS !== 'web' && Boolean(delivery && deliveryMapRoute(delivery))

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={delivery ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor="#7c3aed"
          />
        ) : undefined}
      >
        <Link href="/" style={styles.back}>← Início</Link>
        <Text style={styles.eyebrow}>ACOMPANHE A VIAGEM</Text>
        <Text style={styles.title}>A aventura da sua carta</Text>

        {!delivery ? (
          <View style={styles.emptyCard}>
            {loading ? (
              <View style={styles.loadingContent}>
                <ActivityIndicator color="#7c3aed" size="large" />
                <Text style={styles.loadingText}>Buscando a entrega…</Text>
              </View>
            ) : (
              <>
                <Text style={styles.emptyTitle}>Abra uma viagem pelo link</Text>
                <Text style={styles.body}>
                  Cole o link completo que você recebeu para acompanhar a entrega sem entrar na sua conta.
                </Text>
                <Text style={styles.inputLabel}>Link de acompanhamento</Text>
                <TextInput
                  accessibilityLabel="Link de acompanhamento"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  onChangeText={setLink}
                  placeholder="Cole o link aqui"
                  style={styles.input}
                  value={link}
                />
                {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
                <Pressable accessibilityRole="button" onPress={submit} style={styles.button}>
                  <Text style={styles.buttonText}>Abrir viagem</Text>
                </Pressable>
                {error && params.publicId && params.token ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => void load(String(params.publicId), String(params.token), true)}
                    style={styles.retryButton}
                  >
                    <Text style={styles.retryButtonText}>Tentar novamente</Text>
                  </Pressable>
                ) : null}
              </>
            )}
          </View>
        ) : (
          <>
            {error ? (
              <View style={styles.refreshError}>
                <Text accessibilityRole="alert" style={styles.error}>{error}</Text>
                <Pressable accessibilityRole="button" onPress={refresh}>
                  <Text style={styles.retryButtonText}>Tentar novamente</Text>
                </Pressable>
              </View>
            ) : null}

            <View style={styles.heroCard}>
              <View style={styles.statusRow}>
                <Text style={styles.status}>{deliveryStatusLabel(delivery.status)}</Text>
                {viewMode === 'progress' ? (
                  <Text style={styles.progressNumber}>{progress}%</Text>
                ) : null}
              </View>
              <Text style={styles.recipient}>Para {delivery.recipient_name}</Text>
              <Text style={styles.heroDescription}>
                {delivery.sender_name
                  ? `Uma surpresa de ${delivery.sender_name} está nesta viagem.`
                  : 'Uma surpresa especial está nesta viagem.'}
              </Text>
              {viewMode === 'progress' ? (
                <>
                  <View
                    accessibilityLabel={`${progress}% da viagem concluída`}
                    accessibilityRole="progressbar"
                    accessibilityValue={{ min: 0, max: 100, now: progress }}
                    style={styles.progressTrack}
                  >
                    <View style={[styles.progressFill, { width: `${progress}%` }]} />
                  </View>
                  <View style={styles.progressLabels}>
                    <Text style={styles.progressLabel}>Partida</Text>
                    <Text style={styles.progressLabel}>Chegada</Text>
                  </View>
                </>
              ) : null}
            </View>

            {mapAvailable ? (
              <View style={styles.viewSwitch}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: viewMode === 'progress' }}
                  onPress={() => setViewMode('progress')}
                  style={[styles.viewSwitchButton, viewMode === 'progress' ? styles.viewSwitchSelected : undefined]}
                >
                  <Text style={[styles.viewSwitchText, viewMode === 'progress' ? styles.viewSwitchTextSelected : undefined]}>
                    Porcentagem
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: viewMode === 'map' }}
                  onPress={() => setViewMode('map')}
                  style={[styles.viewSwitchButton, viewMode === 'map' ? styles.viewSwitchSelected : undefined]}
                >
                  <Text style={[styles.viewSwitchText, viewMode === 'map' ? styles.viewSwitchTextSelected : undefined]}>
                    Mapa
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {viewMode === 'map' && mapAvailable ? (
              <DeliveryJourneyMap
                courierImage={courier?.image}
                delivery={delivery}
                fetchedAt={fetchedAt}
              />
            ) : null}

            <View style={styles.routeCard}>
              <Text style={styles.sectionEyebrow}>ROTA DA CARTA</Text>
              <View style={styles.routeRow}>
                <View style={styles.routeRail}>
                  <View style={styles.originDot} />
                  <View style={styles.routeLine} />
                  <View style={styles.destinationDot} />
                </View>
                <View style={styles.routePlaces}>
                  <View style={styles.routePlace}>
                    <Text style={styles.placeLabel}>ORIGEM</Text>
                    <Text style={styles.placeName}>{delivery.origin}</Text>
                  </View>
                  <View style={styles.routePlace}>
                    <Text style={styles.placeLabel}>DESTINO</Text>
                    <Text style={styles.placeName}>{delivery.destination}</Text>
                  </View>
                </View>
              </View>
              {arrival && delivery.status !== 'DELIVERED' ? (
                <View style={styles.arrivalPanel}>
                  <Text style={styles.arrivalLabel}>Chegada prevista</Text>
                  <Text style={styles.arrivalValue}>{arrival}</Text>
                </View>
              ) : null}
            </View>

            {courier ? (
              <View style={styles.courierCard}>
                <Image accessible={false} source={courier.image} style={styles.courierImage} />
                <View style={styles.courierInfo}>
                  <Text style={styles.sectionEyebrow}>ENTREGADOR</Text>
                  <Text style={styles.courierName}>{courier.name}</Text>
                  <Text style={styles.courierDescription}>Levando esta surpresa até o destino.</Text>
                </View>
              </View>
            ) : null}

            {delivery.access_role === 'recipient' && delivery.status !== 'DELIVERED' && !message ? (
              <View style={styles.waitingCard}>
                <Text style={styles.waitingTitle}>
                  {delivery.status === 'SCHEDULED' ? 'A carta está se preparando.' : 'A mensagem está viajando.'}
                </Text>
                <Text style={styles.waitingBody}>
                  Você poderá abrir a surpresa quando ela chegar. A viagem é atualizada automaticamente a cada 30 segundos.
                </Text>
              </View>
            ) : null}

            {delivery.access_role === 'recipient' && delivery.status === 'DELIVERED' && !message ? (
              <View style={styles.revealCard}>
                <Text style={styles.revealTitle}>A carta chegou ✦</Text>
                <Text style={styles.revealBody}>A surpresa está pronta para ser aberta.</Text>
                <Pressable
                  accessibilityRole="button"
                  disabled={openingMessage}
                  onPress={() => void revealMessage()}
                  style={styles.button}
                >
                  {openingMessage ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.buttonText}>Abrir mensagem</Text>
                  )}
                </Pressable>
                {messageError ? <Text accessibilityRole="alert" style={styles.error}>{messageError}</Text> : null}
              </View>
            ) : null}

            {delivery.access_role === 'sender' ? (
              <>
                <View style={styles.senderCard}>
                  <Text style={styles.senderTitle}>
                    {delivery.status === 'DELIVERED'
                      ? 'Sua carta chegou.'
                      : delivery.status === 'SCHEDULED'
                        ? 'Sua carta está pronta para partir.'
                        : 'Sua carta está a caminho.'}
                  </Text>
                  <Text style={styles.senderBody}>
                    {delivery.status === 'DELIVERED'
                      ? 'O destinatário já pode abrir a surpresa pelo link dele.'
                      : 'Compartilhe o link do destinatário para que ele acompanhe a viagem.'}
                  </Text>
                </View>

                <View style={styles.shareCard}>
                  <Text style={styles.sectionEyebrow}>LINK DO DESTINATÁRIO</Text>
                  <Text style={styles.shareTitle}>Compartilhe a surpresa</Text>
                  <Text style={styles.shareDescription}>
                    Recupere o link para enviar novamente a quem vai receber a carta.
                  </Text>

                  {recipientShareUrl ? (
                    <>
                      <View style={styles.sharePreview}>
                        <Text numberOfLines={1} style={styles.sharePreviewText}>
                          {previewDeliveryShareUrl(recipientShareUrl)}
                        </Text>
                      </View>
                      <View style={styles.shareActions}>
                        <Pressable
                          accessibilityRole="button"
                          disabled={copyingShareLink}
                          onPress={() => void copyRecipientShareLink()}
                          style={styles.sharePrimaryButton}
                        >
                          <Text style={styles.sharePrimaryText}>
                            {copyingShareLink ? 'Copiando…' : 'Copiar link'}
                          </Text>
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => void shareRecipientShareLink()}
                          style={styles.shareSecondaryButton}
                        >
                          <Text style={styles.shareSecondaryText}>Compartilhar</Text>
                        </Pressable>
                      </View>
                      {shareLinkCopied ? (
                        <Text accessibilityRole="alert" style={styles.shareCopied}>
                          Link completo copiado.
                        </Text>
                      ) : null}
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => setShowFullShareLink(!showFullShareLink)}
                        style={styles.showFullLinkButton}
                      >
                        <Text style={styles.showFullLinkText}>
                          {showFullShareLink ? 'Ocultar link completo' : 'Ver link completo'}
                        </Text>
                      </Pressable>
                      {showFullShareLink ? (
                        <Text selectable style={styles.fullShareLink}>{recipientShareUrl}</Text>
                      ) : null}
                    </>
                  ) : (
                    <Pressable
                      accessibilityRole="button"
                      disabled={shareLinkLoading}
                      onPress={() => void loadRecipientShareLink()}
                      style={[styles.sharePrimaryButton, styles.shareLoadButton]}
                    >
                      {shareLinkLoading ? (
                        <ActivityIndicator color="#ffffff" />
                      ) : (
                        <Text style={styles.sharePrimaryText}>Obter link do destinatário</Text>
                      )}
                    </Pressable>
                  )}

                  {shareLinkError ? (
                    <Text accessibilityRole="alert" style={styles.error}>{shareLinkError}</Text>
                  ) : null}
                </View>
              </>
            ) : null}

            {message ? (
              <View style={styles.messageCard}>
                <Text style={styles.messageEyebrow}>SUA CARTA</Text>
                <Text style={styles.messageText}>{message}</Text>
              </View>
            ) : null}

            {delivery.status !== 'DELIVERED' ? (
              <Pressable
                accessibilityRole="button"
                disabled={refreshing}
                onPress={refresh}
                style={styles.refreshButton}
              >
                <Text style={styles.refreshButtonText}>
                  {refreshing ? 'Atualizando…' : 'Atualizar acompanhamento'}
                </Text>
              </Pressable>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#fffaf4',
    flex: 1,
  },
  container: {
    backgroundColor: '#fffaf4',
    flexGrow: 1,
    padding: 24,
    paddingBottom: 44,
  },
  back: {
    color: '#7c3aed',
    fontSize: 16,
    marginBottom: 28,
    marginTop: 8,
  },
  eyebrow: {
    color: '#7c3aed',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.6,
    marginBottom: 8,
  },
  title: {
    color: '#241b35',
    fontSize: 30,
    fontWeight: '800',
    lineHeight: 36,
    marginBottom: 22,
  },
  body: {
    color: '#665d70',
    fontSize: 15,
    lineHeight: 23,
    marginTop: 8,
  },
  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
  },
  emptyTitle: {
    color: '#241b35',
    fontSize: 21,
    fontWeight: '800',
  },
  loadingContent: {
    alignItems: 'center',
    gap: 16,
    paddingVertical: 40,
  },
  loadingText: {
    color: '#665d70',
    fontSize: 15,
  },
  inputLabel: {
    color: '#241b35',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
    marginTop: 22,
  },
  input: {
    backgroundColor: '#fffdfb',
    borderColor: '#e5dcef',
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 15,
    minHeight: 50,
    paddingHorizontal: 14,
  },
  error: {
    color: '#b42318',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 10,
  },
  button: {
    alignItems: 'center',
    backgroundColor: '#7c3aed',
    borderRadius: 12,
    justifyContent: 'center',
    minHeight: 50,
    marginTop: 18,
    paddingHorizontal: 16,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  retryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    marginTop: 10,
  },
  retryButtonText: {
    color: '#7c3aed',
    fontSize: 15,
    fontWeight: '700',
  },
  refreshError: {
    backgroundColor: '#fff3d6',
    borderRadius: 12,
    marginBottom: 16,
    padding: 16,
  },
  heroCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
  },
  statusRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  status: {
    color: '#7c3aed',
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '800',
  },
  progressNumber: {
    color: '#4b2782',
    fontSize: 22,
    fontWeight: '800',
    marginLeft: 12,
  },
  recipient: {
    color: '#241b35',
    fontSize: 25,
    fontWeight: '800',
    lineHeight: 31,
  },
  heroDescription: {
    color: '#665d70',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
  },
  progressTrack: {
    backgroundColor: '#eee8f7',
    borderRadius: 99,
    height: 12,
    marginTop: 26,
    overflow: 'hidden',
  },
  progressFill: {
    backgroundColor: '#7c3aed',
    borderRadius: 99,
    height: '100%',
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  progressLabel: {
    color: '#8a8193',
    fontSize: 12,
  },
  viewSwitch: {
    backgroundColor: '#eee8f7',
    borderRadius: 14,
    flexDirection: 'row',
    marginTop: 16,
    padding: 4,
  },
  viewSwitchButton: {
    alignItems: 'center',
    borderRadius: 11,
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
  },
  viewSwitchSelected: {
    backgroundColor: '#ffffff',
  },
  viewSwitchText: {
    color: '#665d70',
    fontSize: 14,
    fontWeight: '700',
  },
  viewSwitchTextSelected: {
    color: '#4b2782',
  },
  routeCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    marginTop: 16,
    padding: 20,
  },
  sectionEyebrow: {
    color: '#7c3aed',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  routeRow: {
    flexDirection: 'row',
    marginTop: 20,
  },
  routeRail: {
    alignItems: 'center',
    marginRight: 14,
    paddingVertical: 6,
  },
  originDot: {
    backgroundColor: '#7c3aed',
    borderRadius: 7,
    height: 14,
    width: 14,
  },
  routeLine: {
    backgroundColor: '#d7c6f1',
    flex: 1,
    minHeight: 34,
    width: 2,
  },
  destinationDot: {
    backgroundColor: '#ffffff',
    borderColor: '#7c3aed',
    borderRadius: 7,
    borderWidth: 3,
    height: 14,
    width: 14,
  },
  routePlaces: {
    flex: 1,
    gap: 18,
  },
  routePlace: {
    minHeight: 52,
  },
  placeLabel: {
    color: '#8a8193',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 5,
  },
  placeName: {
    color: '#241b35',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
  arrivalPanel: {
    backgroundColor: '#f7f2ff',
    borderRadius: 12,
    marginTop: 16,
    padding: 14,
  },
  arrivalLabel: {
    color: '#665d70',
    fontSize: 13,
  },
  arrivalValue: {
    color: '#4b2782',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 4,
  },
  courierCard: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    flexDirection: 'row',
    marginTop: 16,
    padding: 16,
  },
  courierImage: {
    borderRadius: 34,
    height: 68,
    marginRight: 14,
    width: 68,
  },
  courierInfo: {
    flex: 1,
  },
  courierName: {
    color: '#241b35',
    fontSize: 17,
    fontWeight: '800',
    marginTop: 5,
  },
  courierDescription: {
    color: '#665d70',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 3,
  },
  revealCard: {
    backgroundColor: '#f1ebff',
    borderRadius: 20,
    marginTop: 16,
    padding: 20,
  },
  revealTitle: {
    color: '#241b35',
    fontSize: 23,
    fontWeight: '800',
  },
  revealBody: {
    color: '#665d70',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
  },
  waitingCard: {
    backgroundColor: '#fff3d6',
    borderRadius: 20,
    marginTop: 16,
    padding: 20,
  },
  waitingTitle: {
    color: '#6d4b00',
    fontSize: 20,
    fontWeight: '800',
  },
  waitingBody: {
    color: '#80631d',
    fontSize: 15,
    lineHeight: 23,
    marginTop: 8,
  },
  senderCard: {
    backgroundColor: '#f1ebff',
    borderRadius: 20,
    marginTop: 16,
    padding: 20,
  },
  senderTitle: {
    color: '#241b35',
    fontSize: 20,
    fontWeight: '800',
  },
  senderBody: {
    color: '#665d70',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
  },
  shareCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    marginTop: 16,
    padding: 20,
  },
  shareTitle: {
    color: '#241b35',
    fontSize: 20,
    fontWeight: '800',
    marginTop: 6,
  },
  shareDescription: {
    color: '#665d70',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 7,
  },
  sharePreview: {
    backgroundColor: '#f7f2ff',
    borderRadius: 12,
    marginTop: 16,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  sharePreviewText: {
    color: '#4b2782',
    fontSize: 15,
    fontWeight: '700',
  },
  shareActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  sharePrimaryButton: {
    alignItems: 'center',
    backgroundColor: '#7c3aed',
    borderRadius: 12,
    flex: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 10,
  },
  shareLoadButton: {
    flex: 0,
    marginTop: 16,
  },
  sharePrimaryText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  shareSecondaryButton: {
    alignItems: 'center',
    borderColor: '#d7c6f1',
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 10,
  },
  shareSecondaryText: {
    color: '#7c3aed',
    fontSize: 14,
    fontWeight: '700',
  },
  shareCopied: {
    color: '#24724b',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 10,
  },
  showFullLinkButton: {
    alignSelf: 'flex-start',
    justifyContent: 'center',
    minHeight: 44,
    marginTop: 4,
  },
  showFullLinkText: {
    color: '#7c3aed',
    fontSize: 13,
    fontWeight: '700',
  },
  fullShareLink: {
    color: '#554766',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 4,
  },
  messageCard: {
    backgroundColor: '#ffffff',
    borderColor: '#e5dcef',
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 16,
    padding: 24,
  },
  messageEyebrow: {
    color: '#7c3aed',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 16,
  },
  messageText: {
    color: '#241b35',
    fontSize: 20,
    lineHeight: 30,
  },
  refreshButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    marginTop: 16,
  },
  refreshButtonText: {
    color: '#7c3aed',
    fontSize: 14,
    fontWeight: '700',
  },
})
