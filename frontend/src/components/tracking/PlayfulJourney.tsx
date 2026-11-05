import { getCourier } from '../../domain/delivery/couriers'
import { formatRemaining, instant } from '../../utils/dateTime'
import { progressMarkerTransform } from '../../utils/progressVisual'
import { handleCourierImageError } from '../delivery/courierImage'

interface PlayfulJourneyProps {
  originLabel: string
  destinationLabel: string
  progress: number
  courier: string
  startsAt: string
  arrivesAt: string
  now: number
}

export function PlayfulJourney({ originLabel, destinationLabel, progress, courier, startsAt, arrivesAt, now }: PlayfulJourneyProps) {
  const courierOption = getCourier(courier)
  const journeyProgress = Math.max(0, Math.min(100, Number.isFinite(progress) ? progress : 0))
  const journeyTiming = now < instant(startsAt)
    ? formatRemaining(startsAt, now).replace('Chega em', 'Parte em')
    : formatRemaining(arrivesAt, now)

  return (
    <section className="playful-journey-card" aria-label="Jornada lúdica da entrega">
      <div className="playful-journey-heading">
        <div>
          <p className="eyebrow">Jornada lúdica</p>
          <h2>Uma trilha feita de imaginação.</h2>
        </div>
        <strong>{journeyProgress}%</strong>
      </div>
      <div
        className="playful-journey-line"
        role="progressbar"
        aria-label="Progresso da jornada lúdica"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={journeyProgress}
        aria-valuetext={`${journeyProgress}% da jornada lúdica`}
      >
        <span className="playful-journey-fill" style={{ width: `${journeyProgress}%` }} />
        <span className="playful-journey-node start" />
        <span className="playful-journey-node end" />
        <span className="playful-journey-courier" style={{ left: `${journeyProgress}%`, transform: progressMarkerTransform(journeyProgress) }}>
          <img src={courierOption.iconAsset} alt="" aria-hidden="true" onError={handleCourierImageError} />
        </span>
      </div>
      <div className="playful-journey-labels">
        <div>
          <small>Partida</small>
          <strong>{originLabel}</strong>
        </div>
        <div className="playful-journey-destination">
          <small>Chegada</small>
          <strong>{destinationLabel}</strong>
        </div>
      </div>
      <div className="playful-journey-footer">
        <span>✦ {courierOption.label}</span>
        <strong>{journeyTiming}</strong>
      </div>
    </section>
  )
}
