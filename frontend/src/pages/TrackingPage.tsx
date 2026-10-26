import { useEffect, useState } from 'react'
import { ApiError, fetchDelivery, openDeliveryMessage } from '../services/api'
import { removeAccessToken, resolveAccessToken } from '../services/accessToken'
import { DeliveryDetails } from '../components/tracking/DeliveryDetails'
import { ErrorState } from '../components/feedback/ErrorState'
import { Loading } from '../components/feedback/Loading'
import { JourneyProgress } from '../components/tracking/JourneyProgress'
import { Shell } from '../components/layout/Shell'
import { SenderOpeningStatus } from '../components/tracking/SenderOpeningStatus'
import { TrackingHeader } from '../components/tracking/TrackingHeader'
import { progressFromTime, statusFromTime } from '../utils/dateTime'
import { DeliveryMap } from '../components/tracking/DeliveryMap'
import { getLocation } from '../domain/delivery/locations'
import { LetterReveal } from '../components/tracking/LetterReveal'
import { JourneyPassport } from '../components/tracking/JourneyPassport'
import { connectToDeliveryChannel } from '../services/realtime'
import type { AccessRole, Delivery, DeliveryStatus } from '../domain/delivery/types'

const initialNow = Date.now()

interface TrackingPageProps {
  publicId: string
  onHome: () => void
  onPrivacy: () => void
}

function locationLabel(value: string) { return getLocation(value)?.label ?? value }

function statusLabel(status: DeliveryStatus) {
  return { SCHEDULED: 'Preparando a partida', IN_TRANSIT: 'A caminho', DELIVERED: 'Chegou ao destino' }[status]
}

export function TrackingPage({ publicId, onHome, onPrivacy }: TrackingPageProps) {
  const [auth, setAuth] = useState<{ ready: boolean; token: string | null; role: AccessRole }>({ ready: false, token: null, role: 'recipient' })
  const [delivery, setDelivery] = useState<Delivery | null>(null)
  const [error, setError] = useState('')
  const [opening, setOpening] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [messageError, setMessageError] = useState('')
  const [realtimeStatus, setRealtimeStatus] = useState<'connecting' | 'connected' | 'received' | 'unavailable' | null>(null)
  const [requestFailed, setRequestFailed] = useState(false)
  const [retryNonce, setRetryNonce] = useState(0)
  const [now, setNow] = useState(initialNow)

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
        if (!cancelled) { setDelivery(response.data); setError(''); setRequestFailed(false) }
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
      setMessageError(caught instanceof ApiError && caught.status === 429 ? 'Muitas tentativas em pouco tempo. Aguarde um pouco e tente novamente.' : caught instanceof ApiError && caught.code === 'DELIVERY_NOT_ARRIVED' ? 'A viagem ainda está a caminho. Tente novamente quando ela chegar.' : 'Não foi possível abrir esta mensagem com este link.')
    } finally { setOpening(false) }
  }

  const isLoading = !auth.ready || (!!auth.token && !delivery && !error)
  if (isLoading) return <Shell eyebrow="Abrindo seu mapa de viagem" onHome={onHome} onPrivacy={onPrivacy}><Loading /></Shell>
  if (!auth.token || error) return <Shell eyebrow={requestFailed ? 'Problema de conexão' : 'A viagem não foi encontrada'} onHome={onHome} onPrivacy={onPrivacy}><ErrorState message={error || 'Este link precisa do token original para abrir a entrega.'} onHome={onHome} onRetry={requestFailed ? () => { setError(''); setRetryNonce((current) => current + 1) } : undefined} /></Shell>
  if (!delivery) return null

  const visualStatus = statusFromTime(delivery, now)
  const visualProgress = progressFromTime(delivery, now)
  const canOpen = visualStatus === 'DELIVERED'
  const visibleRealtimeStatus = auth.ready && auth.token && broadcastRole ? realtimeStatus : null

  return <Shell eyebrow="Acompanhamento da aventura" onHome={onHome} onPrivacy={onPrivacy}>
    <TrackingHeader recipientName={delivery.recipient_name} senderName={delivery.sender_name} statusClass={visualStatus.toLowerCase()} statusLabel={statusLabel(visualStatus)} />
    <JourneyProgress originLabel={locationLabel(delivery.origin)} destinationLabel={locationLabel(delivery.destination)} progress={visualProgress} courier={delivery.courier} arrivesAt={delivery.arrives_at} now={now} />
    <JourneyPassport publicId={delivery.public_id} originLabel={locationLabel(delivery.origin)} destinationLabel={locationLabel(delivery.destination)} courier={delivery.courier} startsAt={delivery.starts_at} arrivesAt={delivery.arrives_at} status={visualStatus} />
    {visibleRealtimeStatus === 'received' && <p className="realtime-indicator" role="status">Sinal em tempo real recebido.</p>}
    {getLocation(delivery.origin) && getLocation(delivery.destination) && <DeliveryMap origin={getLocation(delivery.origin)!} destination={getLocation(delivery.destination)!} courier={delivery.courier} startsAt={delivery.starts_at} arrivesAt={delivery.arrives_at} />}
    <DeliveryDetails startsAt={delivery.starts_at} arrivesAt={delivery.arrives_at} />
    {delivery.access_role === 'sender' ? <SenderOpeningStatus openedAt={delivery.opened_at} /> : <LetterReveal key={message ?? 'closed'} courier={delivery.courier} canOpen={canOpen} opening={opening} message={message} error={messageError} onOpen={() => { void revealMessage() }} />}
  </Shell>
}
