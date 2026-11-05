import { useEffect, useState } from 'react'
import type { CreateDeliveryInput } from '../../domain/delivery/types'
import { getCourier } from '../../domain/delivery/couriers'
import { handleCourierImageError } from './courierImage'

interface DeliverySummaryProps {
  form: CreateDeliveryInput
  adventureEnabled: boolean
}

function formatDuration(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return 'Ainda não definida'
  if (minutes % 1440 === 0) return `${minutes / 1440} ${minutes / 1440 === 1 ? 'dia' : 'dias'}`
  if (minutes % 60 === 0) return `${minutes / 60} ${minutes / 60 === 1 ? 'hora' : 'horas'}`
  return `${minutes} minutos`
}

function getTotalDuration(form: CreateDeliveryInput): number {
  if (form.arrival_at) {
    const arrivalAt = new Date(form.arrival_at)
    if (!Number.isNaN(arrivalAt.getTime())) return Math.ceil((arrivalAt.getTime() - Date.now()) / 60000)
  }
  if (!form.steps?.length) return Number(form.duration_minutes)
  return form.steps.reduce(
    (total, step) => total + Number(step.duration_minutes || 0),
    Number(form.final_duration_minutes || 0),
  )
}

function getRouteState(form: CreateDeliveryInput): { ready: boolean; note: string } {
  if (form.delivery_mode === 'playful') {
    if (!form.origin.trim() || !form.destination.trim()) {
      return { ready: false, note: 'Informe a origem e o destino imaginários para completar o percurso.' }
    }

    if (form.origin.trim() === form.destination.trim()) {
      return { ready: false, note: 'Escolha nomes diferentes para a origem e o destino.' }
    }

    return { ready: true, note: 'Percurso imaginário pronto para a viagem.' }
  }

  if (!form.origin_location) return { ready: false, note: 'Escolha a origem para traçar o percurso.' }
  if (form.destination_source !== 'specific') return { ready: true, note: 'O destino protegido será resolvido no momento do envio.' }
  if (!form.destination_location) return { ready: false, note: 'Escolha o destino para traçar o percurso.' }

  const sameLocation = form.origin_location.latitude === form.destination_location.latitude
    && form.origin_location.longitude === form.destination_location.longitude

  return sameLocation
    ? { ready: false, note: 'Escolha lugares diferentes para traçar o percurso.' }
    : { ready: true, note: 'Percurso pronto para a viagem.' }
}

function getLocationLabel(form: CreateDeliveryInput, kind: 'origin' | 'destination'): string {
  if (form.delivery_mode === 'playful') {
    const value = kind === 'origin' ? form.origin : form.destination
    return value.trim() || `${kind === 'origin' ? 'Origem' : 'Destino'} não definida`
  }

  if (kind === 'destination' && form.destination_source !== 'specific') return 'Destino protegido'

  const location = kind === 'origin' ? form.origin_location : form.destination_location
  return location?.label ?? `${kind === 'origin' ? 'Origem' : 'Destino'} não definida`
}

export function DeliverySummary({ form, adventureEnabled }: DeliverySummaryProps) {
  const [now, setNow] = useState(() => Date.now())
  const courier = getCourier(form.courier)
  const duration = getTotalDuration(form)
  const arrivalAt = form.arrival_at ? new Date(form.arrival_at) : null
  const route = getRouteState(form)
  const origin = getLocationLabel(form, 'origin')
  const destination = getLocationLabel(form, 'destination')
  const stops = form.steps ?? []
  const adventureComplete = !adventureEnabled && stops.length === 0 || (
    stops.length > 0
    && stops.every((step) => Number(step.duration_minutes) > 0)
    && Number(form.final_duration_minutes) > 0
  )
  const canEstimateArrival = adventureEnabled && route.ready && adventureComplete && duration > 0

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <aside className="delivery-summary" aria-label="Bilhete de postagem">
      <div className="summary-heading">
        <strong>Bilhete de postagem</strong>
        <span>Confira antes de enviar.</span>
      </div>
      <div className="summary-grid">
        <div className="summary-primary">
          <span>Modalidade</span>
          <strong>{adventureEnabled ? 'Criar uma aventura' : 'Entrega direta'}</strong>
        </div>
        <div className="summary-primary summary-route-overview">
          <span>Percurso</span>
          <strong>{origin} → {destination}</strong>
        </div>
        <div className="summary-primary">
          <span>{adventureEnabled ? 'Duração' : 'Chegada'}</span>
          <strong>{adventureEnabled
            ? formatDuration(duration)
            : arrivalAt && !Number.isNaN(arrivalAt.getTime())
              ? arrivalAt.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
              : 'Ainda não definida'}</strong>
        </div>
        <div className="summary-primary">
          <span>Desbloqueio</span>
          <strong>
            {form.unlock_type === 'password'
              ? 'Proteger com senha'
              : form.unlock_type === 'hangman'
                ? 'Jogo da forca'
                : 'Abrir normalmente'}
          </strong>
        </div>
        <div>
          <span>Para</span>
          <strong>{form.recipient_name.trim() || 'Seu destinatário'}</strong>
        </div>
        <div className="summary-courier">
          <span>Entregador</span>
          <img src={courier.cardAsset} alt={courier.label} onError={handleCourierImageError} />
          <strong>{courier.label}</strong>
        </div>
        {stops.length ? (
          <div>
            <span>Paradas</span>
            <strong>{stops.length}</strong>
          </div>
        ) : null}
      </div>
      <div className="summary-route" aria-label="Resumo do percurso">
        <div className="summary-route-point start">
          <span />
          <strong>{origin}</strong>
        </div>
        {stops.map((step, index) => (
          <div className="summary-route-point" key={step.id ?? index}>
            <i>{step.duration_minutes || 0} min</i>
            <span />
            <strong>{step.location?.label || step.title || `Parada ${index + 1}`}</strong>
          </div>
        ))}
        <div className="summary-route-point end">
            <i>{stops.length
              ? form.final_duration_minutes
                ? `${form.final_duration_minutes} min`
                : 'até a chegada'
              : 'chegada'}</i>
          <span />
          <strong>{destination}</strong>
        </div>
      </div>
      {canEstimateArrival ? (
        <p className="summary-arrival">
          Chegada estimada se enviar agora: {new Date(now + duration * 60000).toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          })}.
        </p>
      ) : null}
      <p className="summary-note">{route.note}</p>
    </aside>
  )
}
