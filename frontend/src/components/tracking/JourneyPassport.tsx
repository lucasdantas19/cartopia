import { getCourier } from '../../domain/delivery/couriers'
import type { DeliveryStep, DeliveryStatus } from '../../domain/delivery/types'
import { instant, formatLocalDate } from '../../utils/dateTime'
import { buildJourneyNarrative } from '../../utils/journeyNarrative'

interface JourneyPassportProps {
  publicId: string
  originLabel: string
  destinationLabel: string
  courier: string
  startsAt: string
  arrivesAt: string
  status: DeliveryStatus
  steps: DeliveryStep[]
  finalDurationMinutes: number | null
  hiddenStepsCount: number
  now: number
}

const stamps: Array<{ status: DeliveryStatus; label: string }> = [
  { status: 'SCHEDULED', label: 'Rota traçada' },
  { status: 'IN_TRANSIT', label: 'Em trânsito' },
  { status: 'DELIVERED', label: 'Entregue' },
]

export function JourneyPassport({ publicId, originLabel, destinationLabel, courier, startsAt, arrivesAt, status, steps, finalDurationMinutes, hiddenStepsCount, now }: JourneyPassportProps) {
  const courierOption = getCourier(courier)
  const activeStamp = stamps.findIndex((stamp) => stamp.status === status)

  return <section className="journey-passport" aria-label="Passaporte da mensagem">
    <div className="passport-heading"><div><p className="passport-kicker">Passaporte da mensagem</p><h2>Uma rota para guardar</h2></div><span className="passport-code">CP-{publicId.slice(0, 6).toUpperCase()}</span></div>
    <div className="passport-route"><div><span>Partida</span><strong>{originLabel}</strong></div><span className="passport-route-line" aria-hidden="true">✦ · · · · ✦</span><div className="passport-destination"><span>Destino</span><strong>{destinationLabel}</strong></div></div>
    <p className="passport-narrative">{buildJourneyNarrative({ origin: originLabel, destination: destinationLabel, status, steps, hiddenSteps: hiddenStepsCount, currentStep: steps.length ? steps.findIndex((step) => now >= instant(step.starts_at) && now < instant(step.arrives_at)) : null })}</p>
    {hiddenStepsCount > 0 && <p className="passport-surprise" role="status">✦ {hiddenStepsCount === 1 ? 'Uma próxima etapa' : `${hiddenStepsCount} próximas etapas`} serão reveladas conforme a viagem continuar.</p>}
    {steps.length > 0 && <div className="passport-steps" aria-label="Capítulos da aventura">{steps.map((step, index) => {
      const completed = now >= instant(step.arrives_at)
      const current = now >= instant(step.starts_at) && !completed
      const locationLabel = step.location?.label ?? (step.location ? `${step.location.latitude?.toFixed(2)}, ${step.location.longitude?.toFixed(2)}` : null)
      return <article className={`passport-step ${completed ? 'completed' : ''} ${current ? 'current' : ''}`} key={`${step.starts_at}-${index}`}><span className="passport-step-marker">{completed ? '✓' : String(index + 1).padStart(2, '0')}</span><div><strong>{step.title}</strong>{step.description && <p>{step.description}</p>}<small>{locationLabel ?? 'Durante o caminho'} · {formatLocalDate(step.starts_at)} – {formatLocalDate(step.arrives_at)}</small></div></article>
    })}{steps.length > 0 && finalDurationMinutes && <article className="passport-step final-step"><span className="passport-step-marker">✦</span><div><strong>Chegada ao destino final</strong><small>Último trecho · {formatLocalDate(steps[steps.length - 1].arrives_at)} – {formatLocalDate(arrivesAt)}</small></div></article>}</div>}
    <div className="passport-meta"><div><span>Entregador</span><strong>{courierOption.label}</strong><em>{courierOption.motto}</em></div><div><span>Partiu em</span><strong>{formatLocalDate(startsAt)}</strong></div><div><span>Chegada prevista</span><strong>{formatLocalDate(arrivesAt)}</strong></div></div>
    <div className="passport-stamps" aria-label="Carimbos da entrega">{stamps.map((stamp, index) => <span className={`passport-stamp ${index <= activeStamp ? 'stamped' : ''} ${stamp.status === status ? 'current' : ''}`} key={stamp.status}>{stamp.label}</span>)}</div>
  </section>
}
