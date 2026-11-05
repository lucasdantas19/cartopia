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
  nextStepArrivesAt?: string | null
  now: number
}

const stamps: Array<{ status: DeliveryStatus; label: string }> = [
  { status: 'SCHEDULED', label: 'Rota traçada' },
  { status: 'IN_TRANSIT', label: 'Em trânsito' },
  { status: 'DELIVERED', label: 'Entregue' },
]

export function JourneyPassport({ publicId, originLabel, destinationLabel, courier, startsAt, arrivesAt, status, steps, finalDurationMinutes, hiddenStepsCount, nextStepArrivesAt, now }: JourneyPassportProps) {
  const courierOption = getCourier(courier)
  const activeStamp = stamps.findIndex((stamp) => stamp.status === status)
  const nextStep = steps.find((step) => now < instant(step.arrives_at))
  const currentStepIndex = steps.findIndex((step) => now >= instant(step.starts_at) && now < instant(step.arrives_at))
  const currentStep = currentStepIndex >= 0 ? steps[currentStepIndex] : null
  const liveStatus = status === 'SCHEDULED'
    ? 'A carta está se preparando para partir.'
    : status === 'DELIVERED'
      ? 'A carta chegou ao destino.'
      : currentStep
        ? `A carta está em ${currentStep.title}.`
        : 'A carta está viajando para o destino.'

  return <section className="journey-passport" aria-label="Passaporte da mensagem">
    <div className="passport-heading">
      <div>
        <p className="passport-kicker">Passaporte da mensagem</p>
        <h2>Uma rota para guardar</h2>
      </div>
      <span className="passport-code">CP-{publicId.slice(0, 6).toUpperCase()}</span>
    </div>
    <div className="passport-route">
      <div><span>Partida</span><strong>{originLabel}</strong></div>
      <span className="passport-route-line" aria-hidden="true">✦ · · · · ✦</span>
      <div className="passport-destination"><span>Destino</span><strong>{destinationLabel}</strong></div>
    </div>
    <div className="passport-live-status" role="status" aria-live="polite">
      <span className="passport-live-status-dot" aria-hidden="true" />
      <div>
        <span>Agora</span>
        <strong>{liveStatus}</strong>
      </div>
    </div>
    <p className="passport-narrative">
      {buildJourneyNarrative({
        origin: originLabel,
        destination: destinationLabel,
        status,
        steps,
        hiddenSteps: hiddenStepsCount,
        currentStep: steps.length ? currentStepIndex : null,
      })}
    </p>
    {status !== 'DELIVERED' && (hiddenStepsCount > 0
      ? <p className="passport-next-step" role="status">A caminho de mais uma parada. <strong>O que acontecerá lá será revelado quando a carta chegar.</strong>{nextStepArrivesAt && <> <span>Chegada prevista: {formatLocalDate(nextStepArrivesAt)}.</span></>}</p>
      : nextStep && <p className="passport-next-step" role="status">Próxima parada: <strong>{nextStep.title}</strong></p>)}
    {hiddenStepsCount > 0 && <p className="passport-surprise" role="status">✦ {hiddenStepsCount === 1 ? 'Uma próxima etapa' : `${hiddenStepsCount} próximas etapas`} serão reveladas conforme a viagem continuar.</p>}
    {steps.length > 0 && <div className="passport-steps" aria-label="Capítulos da aventura">{steps.map((step, index) => {
      const completed = now >= instant(step.arrives_at)
      const current = index === currentStepIndex
      const locationLabel = step.location?.label ?? (step.location ? `${step.location.latitude?.toFixed(2)}, ${step.location.longitude?.toFixed(2)}` : null)
      return (
        <article className={`passport-step ${completed ? 'completed' : ''} ${current ? 'current' : ''}`} aria-current={current ? 'step' : undefined} key={`${step.starts_at}-${index}`}>
          <span className="passport-step-marker">{completed ? '✓' : String(index + 1).padStart(2, '0')}</span>
          <div>
            <div className="passport-step-title">
              <strong>{step.title}</strong>
              {current && <span className="passport-step-now">Agora</span>}
            </div>
            {step.description && <p>{step.description}</p>}
            <small>{locationLabel ?? 'Durante o caminho'} · {formatLocalDate(step.starts_at)} – {formatLocalDate(step.arrives_at)}</small>
          </div>
        </article>
      )
    })}{steps.length > 0 && finalDurationMinutes && <article className="passport-step final-step"><span className="passport-step-marker">✦</span><div><strong>Chegada ao destino final</strong><small>Último trecho · {formatLocalDate(steps[steps.length - 1].arrives_at)} – {formatLocalDate(arrivesAt)}</small></div></article>}</div>}
    <div className="passport-meta">
      <div><span>Entregador</span><strong>{courierOption.label}</strong><em>{courierOption.motto}</em></div>
      <div><span>Partiu em</span><strong>{formatLocalDate(startsAt)}</strong></div>
      <div><span>Chegada prevista</span><strong>{formatLocalDate(arrivesAt)}</strong></div>
    </div>
    <div className="passport-stamps" aria-label="Carimbos da entrega">{stamps.map((stamp, index) => <span className={`passport-stamp ${index <= activeStamp ? 'stamped' : ''} ${stamp.status === status ? 'current' : ''}`} key={stamp.status}>{stamp.label}</span>)}</div>
  </section>
}
