import { colors } from '../src/theme'
import { useEffect, useRef, useState } from 'react'
import * as Clipboard from 'expo-clipboard'
import { Link, useLocalSearchParams, useRouter } from 'expo-router'
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as Linking from 'expo-linking'
import { ApiError, fetchDelivery, fetchDeliveryChallenge, fetchRecipientShareLink, openDeliveryMessage, resetDeliveryChallenge, submitDeliveryChallenge } from '../src/api'
import { createDeliveryShareUrl, parseDeliveryLink, previewDeliveryShareUrl } from '../src/deepLinks'
import { saveRecentDelivery } from '../src/recentDeliveries'
import { webUrl } from '../src/config'
import type { Delivery } from '../src/domain'
import { DeliveryJourneyMap } from '../src/components/DeliveryJourneyMap'
import { PlayfulJourney } from '../src/components/PlayfulJourney'
import { HangmanLock } from '../src/components/HangmanLock'
import { useSession } from '../src/context/SessionContext'
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
  const params = useLocalSearchParams<{ publicId?: string; token?: string; fromAccount?: string; view?: string }>()
  const router = useRouter()
  const { session, sessionExpired } = useSession()
  const accessToken = params.fromAccount === 'sender' || params.fromAccount === 'recipient'
    ? session?.token
    : typeof params.token === 'string' ? params.token : undefined
  const [link, setLink] = useState('')
  const [delivery, setDelivery] = useState<Delivery | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [messageError, setMessageError] = useState('')
  const [challenge, setChallenge] = useState<{ type: 'none' | 'password' | 'hangman'; solved: boolean; attemptsRemaining: number; pattern?: string; guessedLetters?: string[]; wrongLetters?: string[] } | null>(null)
  const [challengeAnswer, setChallengeAnswer] = useState('')
  const [challengeError, setChallengeError] = useState('')
  const [challengeSubmitting, setChallengeSubmitting] = useState(false)
  const [resettingChallenge, setResettingChallenge] = useState(false)
  const [recentSaveError, setRecentSaveError] = useState('')
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
  const autoOpenRequested = useRef(false)

  useEffect(() => {
    const publicId = typeof params.publicId === 'string' ? params.publicId : undefined
    const token = accessToken
    requestId.current += 1
    messageRequestId.current += 1
    shareRequestId.current += 1
    autoOpenRequested.current = false
    setDelivery(null)
    setMessage(null)
    setMessageError('')
    setRecentSaveError('')
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
  }, [params.publicId, accessToken])

  useEffect(() => () => {
    requestId.current += 1
    messageRequestId.current += 1
    shareRequestId.current += 1
  }, [])

  useEffect(() => {
    const publicId = typeof params.publicId === 'string' ? params.publicId : undefined
    const token = accessToken
    if (!publicId || !token || delivery?.status === 'DELIVERED') return

    const refresh = setInterval(() => {
      void load(publicId, token)
    }, 30000)

    return () => clearInterval(refresh)
  }, [delivery?.status, params.publicId, accessToken])

  useEffect(() => {
    const subscription = Linking.addEventListener('url', ({ url }) => {
      const parsed = parseDeliveryLink(url)
      if (parsed) router.setParams({ publicId: parsed.publicId, token: parsed.token, fromAccount: '' })
    })

    return () => subscription.remove()
  }, [router])

  async function load(publicId: string, token: string, showLoading = false, showRefreshing = false) {
    const currentRequest = ++requestId.current
    if (showLoading) setLoading(true)
    if (showRefreshing) setRefreshing(true)
    setError('')
    try {
      const role = params.fromAccount === 'sender' || params.fromAccount === 'recipient'
        ? params.fromAccount
        : undefined
      const response = await fetchDelivery(publicId, token, role)
      if (requestId.current === currentRequest) {
        setDelivery(response.data)
        setFetchedAt(Date.now())
        if (showLoading && Platform.OS !== 'web' && !params.fromAccount && response.data.access_role) {
          try {
            await saveRecentDelivery({
              publicId: response.data.public_id,
              accessToken: token,
              role: response.data.access_role,
              recipientName: response.data.recipient_name,
              origin: response.data.origin,
              destination: response.data.destination,
              createdAt: new Date().toISOString(),
            })
          } catch {
            if (requestId.current === currentRequest) {
              setRecentSaveError('Não foi possível salvar esta viagem neste celular. Guarde o link para abri-la novamente.')
            }
          }
        }
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
    router.setParams({ publicId: parsed.publicId, token: parsed.token, fromAccount: '' })
  }

  async function revealMessage() {
    const publicId = typeof params.publicId === 'string' ? params.publicId : undefined
    const token = accessToken
    if (!publicId || !token) return

    const currentRequest = ++messageRequestId.current
    setOpeningMessage(true)
    setMessageError('')
    try {
      const response = await openDeliveryMessage(publicId, token, Boolean(params.fromAccount))
      if (messageRequestId.current === currentRequest) setMessage(response.data.message)
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'DELIVERY_CHALLENGE_REQUIRED') {
        try {
          const response = await fetchDeliveryChallenge(publicId, token)
          setChallenge({ type: response.data.type, solved: response.data.solved, attemptsRemaining: response.data.attempts_remaining, pattern: response.data.pattern, guessedLetters: response.data.guessed_letters, wrongLetters: response.data.wrong_letters })
        } catch {
          setChallengeError('Não foi possível carregar o desafio desta carta.')
        }
        return
      }
      if (messageRequestId.current === currentRequest) {
        setMessageError(caught instanceof ApiError ? caught.message : 'Não foi possível abrir a mensagem agora.')
      }
    } finally {
      if (messageRequestId.current === currentRequest) setOpeningMessage(false)
    }
  }

  async function solveChallenge() {
    if (!accessToken || !params.publicId || !challengeAnswer.trim()) return
    setChallengeSubmitting(true)
    setChallengeError('')
    try {
      const response = await submitDeliveryChallenge(String(params.publicId), accessToken, challengeAnswer.trim())
      setChallenge((current) => current ? { ...current, solved: true, attemptsRemaining: response.data.attempts_remaining } : current)
      await revealMessage()
    } catch (caught) {
      setChallengeError(caught instanceof ApiError ? caught.message : 'Não foi possível verificar a senha.')
      if (caught instanceof ApiError) {
        try {
          const response = await fetchDeliveryChallenge(String(params.publicId), accessToken)
          setChallenge((current) => current ? { ...current, attemptsRemaining: response.data.attempts_remaining, pattern: response.data.pattern, guessedLetters: response.data.guessed_letters, wrongLetters: response.data.wrong_letters } : current)
        } catch { /* Keep the last known attempt count. */ }
      }
    } finally { setChallengeSubmitting(false) }
  }

  async function resetChallenge() {
    if (!accessToken || !params.publicId) return
    setResettingChallenge(true)
    try {
      await resetDeliveryChallenge(String(params.publicId), accessToken)
      setDelivery((current) => current ? { ...current, unlock_locked: false } : current)
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Não foi possível liberar uma nova tentativa.')
    } finally { setResettingChallenge(false) }
  }

  useEffect(() => {
    if (params.view !== 'letter' || !delivery || message || delivery.status !== 'DELIVERED' || openingMessage || autoOpenRequested.current) return
    autoOpenRequested.current = true
    void revealMessage()
  }, [params.view, delivery, message, openingMessage])

  async function loadRecipientShareLink() {
    const publicId = typeof params.publicId === 'string' ? params.publicId : undefined
    const senderToken = accessToken
    if (!publicId || !senderToken || delivery?.access_role !== 'sender') return

    const currentRequest = ++shareRequestId.current
    setShareLinkLoading(true)
    setShareLinkError('')

    try {
      const response = await fetchRecipientShareLink(publicId, senderToken, Boolean(params.fromAccount))
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
    const token = accessToken
    if (publicId && token) void load(publicId, token, false, true)
  }

  const progress = delivery ? deliveryProgressPercent(delivery.progress) : 0
  const courier = delivery ? couriers[delivery.courier as keyof typeof couriers] : undefined
  const arrival = delivery ? arrivalLabel(delivery.arrives_at) : null
  const mapAvailable = Platform.OS !== 'web' && Boolean(delivery && deliveryMapRoute(delivery))

  if (params.view === 'letter' && message) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.container}>
          <Link href="/(tabs)/journeys" style={styles.back}>← Mensagens recebidas</Link>
          <Text style={styles.eyebrow}>MENSAGEM RECEBIDA</Text>
          <Text style={styles.title}>Sua carta</Text>
          <View style={styles.messageCard}>
            <Text style={styles.messageEyebrow}>SUA CARTA</Text>
            <Text style={styles.messageText}>{message}</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    )
  }

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
                <Text style={styles.emptyTitle}>
                  {params.fromAccount && !session ? 'Entre para continuar' : 'Abra uma viagem pelo link'}
                </Text>
                <Text style={styles.body}>
                  {params.fromAccount && !session
                    ? sessionExpired
                      ? 'Sua sessão terminou. Entre novamente para abrir esta viagem.'
                      : 'Esta viagem precisa da sua conta para ser aberta.'
                    : 'Cole o link completo que você recebeu para acompanhar a entrega sem entrar na sua conta.'}
                </Text>
                {params.fromAccount && !session ? (
                  <Link href="/auth" asChild>
                    <Pressable accessibilityRole="button" style={styles.button}>
                      <Text style={styles.buttonText}>Entrar novamente</Text>
                    </Pressable>
                  </Link>
                ) : null}
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
                {error && params.publicId && accessToken ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => void load(String(params.publicId), accessToken, true)}
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
            {recentSaveError ? (
              <Text accessibilityRole="alert" style={styles.error}>{recentSaveError}</Text>
            ) : null}
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

            {delivery.delivery_mode === 'playful' ? (
              <PlayfulJourney
                courierImage={courier?.image}
                destination={delivery.destination}
                origin={delivery.origin}
                progress={progress}
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

            {delivery.steps && delivery.steps.length > 0 ? (
              <View style={styles.stepsCard}>
                <Text style={styles.sectionEyebrow}>PASSAPORTE DA AVENTURA</Text>
                <Text style={styles.stepsTitle}>Paradas da viagem</Text>
                {delivery.steps.map((step, index) => {
                  const arrived = step.arrives_at ? new Date(step.arrives_at).getTime() <= Date.now() : false
                  const current = !arrived && (index === 0 || !delivery.steps?.[index - 1]?.arrives_at || new Date(delivery.steps[index - 1].arrives_at!).getTime() <= Date.now())
                  return (
                    <View key={`${step.title}-${index}`} style={[styles.stepRow, current ? styles.stepCurrent : undefined]}>
                      <View style={[styles.stepMarker, arrived ? styles.stepCompleted : undefined]}>
                        <Text style={styles.stepMarkerText}>{arrived ? '✓' : index + 1}</Text>
                      </View>
                      <View style={styles.stepContent}>
                        <View style={styles.stepHeading}>
                          <Text style={styles.stepTitle}>{step.title}</Text>
                          {current ? <Text style={styles.stepNow}>AGORA</Text> : null}
                        </View>
                        {step.description ? <Text style={styles.stepDescription}>{step.description}</Text> : null}
                        {step.arrives_at ? <Text style={styles.stepTime}>{arrived ? 'Chegou' : `Chegada: ${arrivalLabel(step.arrives_at) ?? 'em breve'}`}</Text> : null}
                      </View>
                    </View>
                  )
                })}
                {delivery.hidden_steps_count ? (
                  <Text style={styles.hiddenSteps}>
                    {delivery.hidden_steps_count} {delivery.hidden_steps_count === 1 ? 'parada ainda será revelada' : 'paradas ainda serão reveladas'} durante a viagem.
                  </Text>
                ) : null}
                {delivery.next_step_arrives_at ? (
                  <Text style={styles.nextStep}>Próxima revelação: {arrivalLabel(delivery.next_step_arrives_at) ?? 'em breve'}</Text>
                ) : null}
              </View>
            ) : null}

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
            {delivery.access_role === 'recipient' && challenge && !challenge.solved ? (
              <View style={styles.challengeCard}>
                <Text style={styles.sectionEyebrow}>DESAFIO DA CARTA</Text>
                <Text style={styles.challengeTitle}>{challenge.type === 'hangman' ? 'Descubra a palavra' : 'Qual é a senha?'}</Text>
                <Text style={styles.challengeDescription}>{challenge.type === 'hangman' ? 'Escolha uma letra por vez para revelar a palavra secreta.' : 'Peça ao remetente a senha para abrir esta mensagem.'}</Text>
                {challenge.type === 'hangman' && challenge.pattern ? <Text style={styles.hangmanPattern}>{challenge.pattern}</Text> : null}
                {challenge.type === 'hangman' ? <HangmanLock wrongCount={challenge.wrongLetters?.length ?? 0} /> : null}
                {challenge.type === 'hangman' && challenge.guessedLetters?.length ? (
                  <View style={styles.hangmanAttempts}>
                    <Text style={styles.challengeDescription}>Letras tentadas</Text>
                    <View style={styles.hangmanLetters}>
                      {challenge.guessedLetters.map((letter) => <Text key={letter} style={[styles.hangmanLetter, challenge.wrongLetters?.includes(letter) ? styles.hangmanWrongLetter : styles.hangmanCorrectLetter]}>{letter}</Text>)}
                    </View>
                  </View>
                ) : null}
                <TextInput
                  accessibilityLabel={challenge.type === 'hangman' ? 'Letra da forca' : 'Senha da carta'}
                  autoCapitalize="none"
                  editable={!challengeSubmitting && challenge.attemptsRemaining > 0}
                  onChangeText={setChallengeAnswer}
                  maxLength={challenge.type === 'hangman' ? 1 : 120}
                  placeholder={challenge.type === 'hangman' ? 'Letra' : 'Digite a senha'}
                  secureTextEntry={challenge.type !== 'hangman'}
                  style={styles.input}
                  value={challengeAnswer}
                />
                <Pressable
                  accessibilityRole="button"
                  disabled={challengeSubmitting || !challengeAnswer.trim() || challenge.attemptsRemaining === 0}
                  onPress={() => void solveChallenge()}
                  style={styles.button}
                >
                  <Text style={styles.buttonText}>{challengeSubmitting ? 'Verificando…' : 'Desbloquear carta'}</Text>
                </Pressable>
                <Text style={styles.challengeDescription}>{challenge.attemptsRemaining > 0 ? `${challenge.attemptsRemaining} tentativa(s) restante(s).` : 'Limite de tentativas atingido.'}</Text>
                {challengeError ? <Text accessibilityRole="alert" style={styles.error}>{challengeError}</Text> : null}
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
                  {delivery.unlock_locked ? (
                    <>
                      <Text style={styles.senderBody}>As tentativas do desafio acabaram. Libere uma nova rodada para o destinatário.</Text>
                      <Pressable accessibilityRole="button" disabled={resettingChallenge} onPress={() => void resetChallenge()} style={styles.button}>
                        <Text style={styles.buttonText}>{resettingChallenge ? 'Liberando…' : 'Liberar nova tentativa'}</Text>
                      </Pressable>
                    </>
                  ) : null}
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
    backgroundColor: colors.background,
    flex: 1,
  },
  container: {
    backgroundColor: colors.background,
    flexGrow: 1,
    padding: 24,
    paddingBottom: 44,
  },
  back: {
    color: colors.primary,
    fontSize: 16,
    marginBottom: 28,
    marginTop: 8,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.6,
    marginBottom: 8,
  },
  title: {
    color: colors.ink,
    fontSize: 30,
    fontWeight: '800',
    lineHeight: 36,
    marginBottom: 22,
  },
  body: {
    color: colors.muted,
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
    color: colors.ink,
    fontSize: 21,
    fontWeight: '800',
  },
  loadingContent: {
    alignItems: 'center',
    gap: 16,
    paddingVertical: 40,
  },
  loadingText: {
    color: colors.muted,
    fontSize: 15,
  },
  inputLabel: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
    marginTop: 22,
  },
  input: {
    backgroundColor: '#fffdfb',
    borderColor: colors.line,
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
    backgroundColor: colors.primary,
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
    color: colors.primary,
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
    color: colors.primary,
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
    color: colors.ink,
    fontSize: 25,
    fontWeight: '800',
    lineHeight: 31,
  },
  heroDescription: {
    color: colors.muted,
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
    backgroundColor: colors.primary,
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
    color: colors.muted,
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
    color: colors.primary,
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
    backgroundColor: colors.primary,
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
    borderColor: colors.primary,
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
  stepsCard: { backgroundColor: '#ffffff', borderColor: colors.line, borderRadius: 18, borderWidth: 1, marginTop: 14, padding: 18 },
  stepsTitle: { color: colors.ink, fontSize: 21, fontWeight: '800', marginBottom: 14 },
  stepRow: { flexDirection: 'row', gap: 12, paddingBottom: 16, paddingTop: 4 },
  stepCurrent: { backgroundColor: '#f8f6fc', borderRadius: 12, paddingHorizontal: 10 },
  stepMarker: { alignItems: 'center', borderColor: colors.line, borderRadius: 14, borderWidth: 1, height: 28, justifyContent: 'center', width: 28 },
  stepCompleted: { backgroundColor: colors.primary, borderColor: colors.primary },
  stepMarkerText: { color: colors.primary, fontSize: 12, fontWeight: '800' },
  stepContent: { flex: 1 },
  stepHeading: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stepTitle: { color: colors.ink, flexShrink: 1, fontSize: 16, fontWeight: '800' },
  stepNow: { color: colors.primary, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  stepDescription: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 4 },
  stepTime: { color: colors.muted, fontSize: 12, marginTop: 5 },
  hiddenSteps: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 4 },
  nextStep: { color: colors.primary, fontSize: 13, fontWeight: '700', marginTop: 8 },
  placeLabel: {
    color: '#8a8193',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 5,
  },
  placeName: {
    color: colors.ink,
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
    color: colors.muted,
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
    color: colors.ink,
    fontSize: 17,
    fontWeight: '800',
    marginTop: 5,
  },
  courierDescription: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 3,
  },
  revealCard: {
    backgroundColor: colors.sand,
    borderRadius: 20,
    marginTop: 16,
    padding: 20,
  },
  revealTitle: {
    color: colors.ink,
    fontSize: 23,
    fontWeight: '800',
  },
  revealBody: {
    color: colors.muted,
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
    backgroundColor: colors.sand,
    borderRadius: 20,
    marginTop: 16,
    padding: 20,
  },
  senderTitle: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: '800',
  },
  senderBody: {
    color: colors.muted,
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
    color: colors.ink,
    fontSize: 20,
    fontWeight: '800',
    marginTop: 6,
  },
  shareDescription: {
    color: colors.muted,
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
    backgroundColor: colors.primary,
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
    color: colors.primary,
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
    color: colors.primary,
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
    borderColor: colors.line,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 16,
    padding: 24,
  },
  messageEyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 16,
  },
  messageText: {
    color: colors.ink,
    fontSize: 20,
    lineHeight: 30,
  },
  challengeCard: {
    backgroundColor: '#fffdfb',
    borderColor: colors.line,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 16,
    padding: 20,
  },
  challengeTitle: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: '800',
    marginTop: 8,
  },
  challengeDescription: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
  },
  hangmanPattern: {
    color: colors.primary,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 3,
    marginTop: 16,
  },
  hangmanAttempts: { marginTop: 14 },
  hangmanLetters: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 7 },
  hangmanLetter: { alignItems: 'center', borderRadius: 6, fontSize: 14, fontWeight: '800', paddingHorizontal: 9, paddingVertical: 7 },
  hangmanCorrectLetter: { backgroundColor: '#e6f4eb', color: '#24724b' },
  hangmanWrongLetter: { backgroundColor: '#fae8e6', color: '#a33b35' },
  refreshButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    marginTop: 16,
  },
  refreshButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
})
