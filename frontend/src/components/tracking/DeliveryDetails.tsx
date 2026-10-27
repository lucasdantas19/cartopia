import { formatLocalDate } from '../../utils/dateTime'

interface DeliveryDetailsProps {
  startsAt: string
  arrivesAt: string
}

export function DeliveryDetails({ startsAt, arrivesAt }: DeliveryDetailsProps) {
  return (
    <section className="details-grid">
      <div>
        <span>Partida</span>
        <strong>{formatLocalDate(startsAt)}</strong>
      </div>
      <div>
        <span>Chegada prevista</span>
        <strong>{formatLocalDate(arrivesAt)}</strong>
      </div>
    </section>
  )
}
