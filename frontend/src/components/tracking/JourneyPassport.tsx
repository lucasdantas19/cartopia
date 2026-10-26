import { getCourier } from '../../domain/delivery/couriers'
import type { DeliveryStatus } from '../../domain/delivery/types'
import { formatLocalDate } from '../../utils/dateTime'

interface JourneyPassportProps {
  publicId: string
  originLabel: string
  destinationLabel: string
  courier: string
  startsAt: string
  arrivesAt: string
  status: DeliveryStatus
}

const stamps: Array<{ status: DeliveryStatus; label: string }> = [
  { status: 'SCHEDULED', label: 'Rota traçada' },
  { status: 'IN_TRANSIT', label: 'Em trânsito' },
  { status: 'DELIVERED', label: 'Entregue' },
]

export function JourneyPassport({ publicId, originLabel, destinationLabel, courier, startsAt, arrivesAt, status }: JourneyPassportProps) {
  const courierOption = getCourier(courier)
  const activeStamp = stamps.findIndex((stamp) => stamp.status === status)

  return <section className="journey-passport" aria-label="Passaporte da mensagem">
    <div className="passport-heading"><div><p className="passport-kicker">Passaporte da mensagem</p><h2>Uma rota para guardar</h2></div><span className="passport-code">CP-{publicId.slice(0, 6).toUpperCase()}</span></div>
    <div className="passport-route"><div><span>Partida</span><strong>{originLabel}</strong></div><span className="passport-route-line" aria-hidden="true">✦ · · · · ✦</span><div className="passport-destination"><span>Destino</span><strong>{destinationLabel}</strong></div></div>
    <div className="passport-meta"><div><span>Entregador</span><strong>{courierOption.label}</strong><em>{courierOption.motto}</em></div><div><span>Partiu em</span><strong>{formatLocalDate(startsAt)}</strong></div><div><span>Chegada prevista</span><strong>{formatLocalDate(arrivesAt)}</strong></div></div>
    <div className="passport-stamps" aria-label="Carimbos da entrega">{stamps.map((stamp, index) => <span className={`passport-stamp ${index <= activeStamp ? 'stamped' : ''} ${stamp.status === status ? 'current' : ''}`} key={stamp.status}>{stamp.label}</span>)}</div>
  </section>
}
