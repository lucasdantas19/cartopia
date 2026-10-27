import type { CreateDeliveryInput } from '../../domain/delivery/types'
import { getCourier } from '../../domain/delivery/couriers'
import { handleCourierImageError } from './courierImage'

interface DeliverySummaryProps {
  form: CreateDeliveryInput
}

export function DeliverySummary({ form }: DeliverySummaryProps) {
  const courier = getCourier(form.courier)
  const origin = form.origin_location ?? { label: 'Origem não definida', latitude: 0, longitude: 0 }
  const destination = form.destination_location ?? { label: 'Destino não definido', latitude: 0, longitude: 0 }
  const totalDuration = form.steps?.length ? form.steps.reduce((total, step) => total + Number(step.duration_minutes || 0), Number(form.final_duration_minutes || 0)) : Number(form.duration_minutes || 0)
  const stops = form.steps ?? []

  return <aside className="delivery-summary" aria-label="Resumo da entrega">
    <div className="summary-heading"><strong>Bilhete de postagem</strong><span>Confira antes de traçar a rota.</span></div>
    <div className="summary-grid">
      <div><span>Formato</span><strong>{form.steps?.length ? 'Com aventura' : 'Entrega direta'}</strong></div>
      <div><span>Para</span><strong>{form.recipient_name.trim() || 'Seu destinatário'}</strong></div>
      <div className="summary-courier"><span>Entregador</span><img src={courier.cardAsset} alt={courier.label} onError={handleCourierImageError} /><strong>{courier.label}</strong></div>
      <div><span>Rota</span><strong>{origin.label} → {destination.label}</strong></div>
      <div><span>Duração</span><strong>{totalDuration || '—'} {totalDuration ? 'minutos' : ''}</strong></div>
      {form.steps?.length ? <div><span>Paradas</span><strong>{form.steps.length}</strong></div> : null}
      {form.steps?.length ? <div><span>Visibilidade</span><strong>{form.route_visibility === 'progressive' ? 'Por etapas' : 'Trajeto completo'}</strong></div> : null}
    </div>
    <div className="summary-route" aria-label="Resumo do percurso">
      <div className="summary-route-point start"><span /> <strong>{origin.label}</strong></div>
      {stops.map((step, index) => <div className="summary-route-point" key={index}><i>{step.duration_minutes || 0} min</i><span /><strong>{step.location?.label || step.title || `Parada ${index + 1}`}</strong></div>)}
      <div className="summary-route-point end"><i>{stops.length ? `${form.final_duration_minutes || 0} min` : `${form.duration_minutes || 0} min`}</i><span /> <strong>{destination.label}</strong></div>
    </div>
    <p className="summary-note">{form.origin === form.destination ? 'Escolha lugares diferentes para traçar a rota.' : 'Tudo pronto para traçar a rota.'}</p>
  </aside>
}
