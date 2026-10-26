import type { CreateDeliveryInput } from '../../domain/delivery/types'
import { getCourier } from '../../domain/delivery/couriers'
import { getLocation } from '../../domain/delivery/locations'
import { handleCourierImageError } from './courierImage'

interface DeliverySummaryProps {
  form: CreateDeliveryInput
}

export function DeliverySummary({ form }: DeliverySummaryProps) {
  const courier = getCourier(form.courier)
  const origin = getLocation(form.origin)
  const destination = getLocation(form.destination)

  return <aside className="delivery-summary" aria-label="Resumo da entrega">
    <div className="summary-heading"><strong>Bilhete de postagem</strong><span>Confira antes de traçar a rota.</span></div>
    <div className="summary-grid">
      <div><span>Para</span><strong>{form.recipient_name.trim() || 'Seu destinatário'}</strong></div>
      <div className="summary-courier"><span>Entregador</span><img src={courier.cardAsset} alt={courier.label} onError={handleCourierImageError} /><strong>{courier.label}</strong></div>
      <div><span>Rota</span><strong>{origin?.label ?? form.origin} → {destination?.label ?? form.destination}</strong></div>
      <div><span>Duração</span><strong>{form.duration_minutes || '—'} {form.duration_minutes ? 'minutos' : ''}</strong></div>
    </div>
  </aside>
}
