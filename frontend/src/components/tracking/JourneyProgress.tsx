import { getCourier } from '../../domain/delivery/couriers'
import { formatRemaining, instant } from '../../utils/dateTime'
import { progressMarkerTransform } from '../../utils/progressVisual'
import { handleCourierImageError } from '../delivery/courierImage'

interface JourneyProgressProps {
  originLabel: string
  destinationLabel: string
  progress: number
  courier: string
  startsAt: string
  arrivesAt: string
  now: number
}

export function JourneyProgress({ originLabel, destinationLabel, progress, courier, startsAt, arrivesAt, now }: JourneyProgressProps) {
  const courierOption = getCourier(courier)
  const journeyTiming = now < instant(startsAt)
    ? formatRemaining(startsAt, now).replace('Chega em', 'Parte em')
    : formatRemaining(arrivesAt, now)

  return (
    <section className="journey-card">
      <div className="journey-meta">
        <span>{originLabel}</span>
        <span>{progress}% da jornada</span>
        <span>{destinationLabel}</span>
      </div>
      <div
        className="journey-line"
        role="progressbar"
        aria-label="Progresso da viagem"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress}
        aria-valuetext={`${progress}% da jornada`}
      >
        <span className="journey-fill" style={{ width: `${progress}%` }} />
        <span className="courier-icon" style={{ left: `${progress}%`, transform: progressMarkerTransform(progress) }}>
          <img src={courierOption.iconAsset} alt="" aria-hidden="true" onError={handleCourierImageError} />
        </span>
        <span className="journey-node start" />
        <span className="journey-node end" />
      </div>
      <div className="journey-footer">
        <span>✦ {courierOption.label}</span>
        <strong>{journeyTiming}</strong>
      </div>
    </section>
  )
}
