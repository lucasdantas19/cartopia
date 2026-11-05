import { useEffect, useRef, useState } from 'react'
import { ApiError, fetchDelivery, fetchDeliveryChallenge, openDeliveryMessage, resetDeliveryChallenge, submitDeliveryChallenge } from '../services/api'
import { removeAccessToken, resolveAccessToken } from '../services/accessToken'
import { DeliveryDetails } from '../components/tracking/DeliveryDetails'
import { ErrorState } from '../components/feedback/ErrorState'
import { Loading } from '../components/feedback/Loading'
import { JourneyProgress } from '../components/tracking/JourneyProgress'
import { PlayfulJourney } from '../components/tracking/PlayfulJourney'
import { Shell } from '../components/layout/Shell'
import { SenderOpeningStatus } from '../components/tracking/SenderOpeningStatus'
import { TrackingHeader } from '../components/tracking/TrackingHeader'
import { progressFromTime, statusFromTime } from '../utils/dateTime'
import { DeliveryMap } from '../components/tracking/DeliveryMap'
import { getLocation } from '../domain/delivery/locations'
import type { DeliveryLocation } from '../domain/delivery/locations'
import { LetterReveal } from '../components/tracking/LetterReveal'
import { DeliveryChallenge } from '../components/tracking/DeliveryChallenge'
import { JourneyPassport } from '../components/tracking/JourneyPassport'
import { connectToDeliveryChannel } from '../services/realtime'
import type { AccessRole, Delivery, DeliveryStatus } from '../domain/delivery/types'

const initialNow = Date.now()

interface TrackingPageProps {
  publicId: string
  onHome: () => void
  onPrivacy: () => void
}

function locationLabel(value: string, customLocation: Delivery['origin_location'] = null) { return customLocation?.label ?? getLocation(value)?.label ?? value }

function mapLocation(value: string, customLocation: Delivery['origin_location'], kind: 'origin' | 'destination'): Omit<DeliveryLocation, 'code'> & { code: string } | undefined {
  if (customLocation) return { code: `endpoint-${kind}`, label: customLocation.label, description: '', coordinates: [customLocation.longitude, customLocation.latitude] }
  return getLocation(value)
}

function statusLabel(status: DeliveryStatus) {
  return { SCHEDULED: 'Preparando a partida', IN_TRANSIT: 'A caminho', DELIVERED: 'Chegou ao destino' }[status]
}

function formatUpdatedAt(timestamp: number): string {
  return new Intl.DateTimeFormat('pt-BR', { timeStyle: 'short' }).format(timestamp)
}

export function TrackingPage({ publicId, onHome, onPrivacy }: TrackingPageProps) {
  const [auth, setAuth] = useState<{ ready: boolean; token: string | null; role: AccessRole }>({ ready: false, token: null, role: 'recipient' })
  const [delivery, setDelivery] = useState<Delivery | null>(null)
  const [error, setError] = useState('')
  const [opening, setOpening] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [messageError, setMessageError] = useState('')
  const [challenge, setChallenge] = useState<{ type: 'none' | 'password' | 'hangman'; solved: boolean; attemptsRemaining: number; pattern?: string; guessedLetters?: string[]; wrongLetters?: string[] } | null>(null)
  const [challengeError, setChallengeError] = useState('')
  const [challengeSubmitting, setChallengeSubmitting] = useState(false)
  const [resettingChallenge, setResettingChallenge] = useState(false)
  const [realtimeStatus, setRealtimeStatus] = useState<'connecting' | 'connected' | 'received' | 'unavailable' | null>(null)
  const [requestFailed, setRequestFailed] = useState(false)
  const [retryNonce, setRetryNonce] = useState(0)
  const [now, setNow] = useState(initialNow)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null)
  const autoOpenRequested = useRef(false)

  useEffect(() => {
    autoOpenRequested.current = false
  }, [publicId])

  useEffect(() => {
    if (!delivery || !auth.token || message !== null || autoOpenRequested.current) return
    if (new URLSearchParams(window.location.search).get('carta') !== '1') return
    if (delivery.status !== 'DELIVERED') return

    autoOpenRequested.current = true
    void revealMessage()
  }, [auth.token, delivery, message])

  useEffect(() => {
    const resolve = window.setTimeout(() => {
      const access = resolveAccessToken(publicId, window.location.hash, window.sessionStorage)
      if (access.fromFragment) window.history.replaceState({}, '', `${window.location.pathname}${window.location.search}`)
      setAuth({ ready: true, token: access.token, role: access.role })
    }, 0)
    return () => window.clearTimeout(resolve)
  }, [publicId])

  useEffect(() => {
    const token = auth.token
    if (!auth.ready || !token) return
    let cancelled = false
    const load = async () => {
      try {
        const response = await fetchDelivery(publicId, token)
        if (!cancelled) { setDelivery(response.data); setLastUpdatedAt(Date.now()); setError(''); setRequestFailed(false) }
      } catch (caught) {
        if (cancelled) return
        if (caught instanceof ApiError && caught.status === 404) {
          removeAccessToken(publicId, window.sessionStorage, auth.role)
          setAuth({ ready: true, token: null, role: auth.role })
          setRequestFailed(false)
          setError('Este link não é válido ou não temos acesso a esta entrega. Abra novamente o link original.')
          return
        }
        setRequestFailed(true)
        setError(caught instanceof ApiError && caught.status === 429 ? 'Muitas consultas em pouco tempo. Aguarde um pouco e tente novamente.' : 'Não foi possível carregar a viagem.')
      }
    }
    void load()
    const refresh = window.setInterval(load, 30000)
    return () => { cancelled = true; window.clearInterval(refresh) }
  }, [auth, publicId, retryNonce])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const broadcastRole = delivery?.access_role
  useEffect(() => {
    if (!auth.ready || !auth.token || !broadcastRole) return
    return connectToDeliveryChannel(publicId, auth.token, broadcastRole, setRealtimeStatus, (openedAt) => {
      setDelivery((current) => current ? { ...current, opened_at: openedAt } : current)
    }) ?? undefined
  }, [auth.ready, auth.token, broadcastRole, publicId])

  async function revealMessage() {
    if (!delivery || !auth.token) return
    setOpening(true); setMessageError('')
    try {
      const response = await openDeliveryMessage(publicId, auth.token)
      setMessage(response.data.message)
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 404) {
        removeAccessToken(publicId, window.sessionStorage, auth.role)
        setAuth({ ready: true, token: null, role: auth.role })
        setError('Este link não é válido ou não temos acesso a esta entrega. Abra novamente o link original.')
        return
      }
      if (caught instanceof ApiError && caught.code === 'DELIVERY_CHALLENGE_REQUIRED') {
        try {
          const challengeResponse = await fetchDeliveryChallenge(publicId, auth.token)
          setChallenge({ type: challengeResponse.data.type, solved: challengeResponse.data.solved, attemptsRemaining: challengeResponse.data.attempts_remaining, pattern: challengeResponse.data.pattern, guessedLetters: challengeResponse.data.guessed_letters, wrongLetters: challengeResponse.data.wrong_letters })
        } catch {
          setChallengeError('Não foi possível carregar o desafio desta carta.')
        }
        return
      }
      setMessageError(caught instanceof ApiError && caught.status === 429 ? 'Muitas tentativas em pouco tempo. Aguarde um pouco e tente novamente.' : caught instanceof ApiError && caught.code === 'DELIVERY_NOT_ARRIVED' ? 'A viagem ainda está a caminho. Tente novamente quando ela chegar.' : 'Não foi possível abrir esta mensagem com este link.')
    } finally { setOpening(false) }
  }

  async function solveChallenge(answer: string) {
    if (!auth.token || !answer.trim()) return
    setChallengeSubmitting(true)
    setChallengeError('')
    try {
      const response = await submitDeliveryChallenge(publicId, auth.token, answer.trim())
      setChallenge((current) => current ? { ...current, solved: true, attemptsRemaining: response.data.attempts_remaining } : current)
      await revealMessage()
    } catch (caught) {
      if (caught instanceof ApiError) {
        try {
          const challengeResponse = await fetchDeliveryChallenge(publicId, auth.token)
          setChallenge((current) => current ? { ...current, attemptsRemaining: challengeResponse.data.attempts_remaining, pattern: challengeResponse.data.pattern, guessedLetters: challengeResponse.data.guessed_letters, wrongLetters: challengeResponse.data.wrong_letters } : current)
        } catch { /* Keep the last known attempt count. */ }
        setChallengeError(caught.message)
      } else setChallengeError('Não foi possível verificar a senha.')
    } finally { setChallengeSubmitting(false) }
  }

  async function resetChallenge() {
    if (!auth.token) return
    setResettingChallenge(true)
    try {
      await resetDeliveryChallenge(publicId, auth.token)
      setDelivery((current) => current ? { ...current, unlock_locked: false } : current)
    } catch (caught) {
      setMessageError(caught instanceof ApiError ? caught.message : 'Não foi possível liberar uma nova tentativa.')
    } finally { setResettingChallenge(false) }
  }

  const isLoading = !auth.ready || (!!auth.token && !delivery && !error)
  if (isLoading) return <Shell eyebrow="Abrindo seu mapa de viagem" onHome={onHome} onPrivacy={onPrivacy}><Loading /></Shell>
  if (!auth.token || error) return <Shell eyebrow={requestFailed ? 'Problema de conexão' : 'A viagem não foi encontrada'} onHome={onHome} onPrivacy={onPrivacy}><ErrorState message={error || 'Este link precisa do token original para abrir a entrega.'} onHome={onHome} onRetry={requestFailed ? () => { setError(''); setRetryNonce((current) => current + 1) } : undefined} /></Shell>
  if (!delivery) return null

  const visualStatus = statusFromTime(delivery, now)
  const visualProgress = progressFromTime(delivery, now)
  const canOpen = visualStatus === 'DELIVERED'
  const visibleRealtimeStatus = auth.ready && auth.token && broadcastRole ? realtimeStatus : null
  const syncMessage = visibleRealtimeStatus === 'unavailable'
    ? 'Tempo real indisponível; a atualização automática continua ativa.'
    : visibleRealtimeStatus === 'connected'
      ? 'Atualização em tempo real ativa.'
      : 'Atualização automática ativa.'
  const originMapLocation = delivery.delivery_mode === 'playful' ? undefined : mapLocation(delivery.origin, delivery.origin_location, 'origin')
  const destinationMapLocation = delivery.delivery_mode === 'playful' ? undefined : mapLocation(delivery.destination, delivery.destination_location, 'destination')

  if (new URLSearchParams(window.location.search).get('carta') === '1' && message !== null) {
    return (
      <Shell eyebrow="Sua carta" onHome={onHome} onPrivacy={onPrivacy}>
        <section className="message-only-view" aria-labelledby="message-only-title">
          <p className="eyebrow">Mensagem recebida</p>
          <h1 id="message-only-title">Uma carta para você</h1>
          <LetterReveal
            courier={delivery.courier}
            canOpen={canOpen}
            opening={false}
            message={message}
            error={messageError}
            onOpen={() => undefined}
          />
        </section>
      </Shell>
    )
  }

  return <Shell eyebrow="Acompanhamento da aventura" onHome={onHome} onPrivacy={onPrivacy}>
    <TrackingHeader recipientName={delivery.recipient_name} senderName={delivery.sender_name} accessRole={auth.role} statusClass={visualStatus.toLowerCase()} statusLabel={statusLabel(visualStatus)} />
    {delivery.delivery_mode === 'playful' ? (
      <PlayfulJourney originLabel={delivery.origin} destinationLabel={delivery.destination} progress={visualProgress} courier={delivery.courier} startsAt={delivery.starts_at} arrivesAt={delivery.arrives_at} now={now} />
    ) : (
      <JourneyProgress originLabel={locationLabel(delivery.origin, delivery.origin_location)} destinationLabel={locationLabel(delivery.destination, delivery.destination_location)} progress={visualProgress} courier={delivery.courier} startsAt={delivery.starts_at} arrivesAt={delivery.arrives_at} now={now} />
    )}
    <p className={`tracking-sync-status ${visibleRealtimeStatus === 'unavailable' ? 'unavailable' : ''}`} role="status">
      {lastUpdatedAt ? `Atualizado às ${formatUpdatedAt(lastUpdatedAt)}. ` : ''}{syncMessage}
    </p>
    <JourneyPassport publicId={delivery.public_id} originLabel={locationLabel(delivery.origin, delivery.origin_location)} destinationLabel={locationLabel(delivery.destination, delivery.destination_location)} courier={delivery.courier} startsAt={delivery.starts_at} arrivesAt={delivery.arrives_at} status={visualStatus} steps={delivery.steps} finalDurationMinutes={delivery.final_duration_minutes} hiddenStepsCount={delivery.hidden_steps_count} now={now} />
    {visibleRealtimeStatus === 'received' && <p className="realtime-indicator" role="status">Sinal em tempo real recebido.</p>}
    {originMapLocation && destinationMapLocation && <DeliveryMap origin={originMapLocation} destination={destinationMapLocation} stops={delivery.steps.flatMap((step, index) => step.location?.latitude !== undefined && step.location.longitude !== undefined ? [{ code: `step-${index}`, label: step.location.label, description: step.description ?? '', coordinates: [step.location.longitude, step.location.latitude] as [number, number], arrivesAt: step.arrives_at }] : [])} routeLegs={delivery.route_legs} hiddenStepsCount={delivery.hidden_steps_count} courier={delivery.courier} startsAt={delivery.starts_at} arrivesAt={delivery.arrives_at} />}
    <DeliveryDetails startsAt={delivery.starts_at} arrivesAt={delivery.arrives_at} />
    {delivery.access_role === 'sender' ? <SenderOpeningStatus openedAt={delivery.opened_at} challengeLocked={delivery.unlock_locked} resettingChallenge={resettingChallenge} onResetChallenge={() => { void resetChallenge() }} /> : challenge && !challenge.solved ? <DeliveryChallenge type={challenge.type === 'hangman' ? 'hangman' : 'password'} pattern={challenge.pattern} guessedLetters={challenge.guessedLetters} wrongLetters={challenge.wrongLetters} attemptsRemaining={challenge.attemptsRemaining} error={challengeError} submitting={challengeSubmitting} onSubmit={(answer) => { void solveChallenge(answer) }} /> : <LetterReveal key={message ?? 'closed'} courier={delivery.courier} canOpen={canOpen} opening={opening} message={message} error={messageError} onOpen={() => { void revealMessage() }} />}
  </Shell>
}
