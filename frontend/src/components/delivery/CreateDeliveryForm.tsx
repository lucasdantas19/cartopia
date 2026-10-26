import type { FormEvent } from 'react'
import { FieldError } from './FieldError'
import { handleCourierImageError } from './courierImage'
import { DeliverySummary } from './DeliverySummary'
import { LocationPreview } from './LocationPreview'
import { couriers } from '../../domain/delivery/couriers'
import { locations } from '../../domain/delivery/locations'
import type { CreateDeliveryInput } from '../../domain/delivery/types'

interface CreateDeliveryFormProps {
  form: CreateDeliveryInput
  error: string
  fieldErrors: Record<string, string[]>
  submitting: boolean
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onFieldChange: (field: keyof CreateDeliveryInput, value: string | number) => void
}

export function CreateDeliveryForm({ form, error, fieldErrors, submitting, onSubmit, onFieldChange }: CreateDeliveryFormProps) {
  return <form className="delivery-form" onSubmit={onSubmit}>
    <div className="form-section"><div className="section-heading"><span>01</span><div><h2>Sua mensagem</h2><p>Escreva a carta e conte-nos quem vai recebê-la.</p></div></div>
      <div className="field-grid"><div><label htmlFor="sender_name">Seu nome <small>(opcional)</small></label><input id="sender_name" maxLength={120} value={form.sender_name} onChange={(event) => onFieldChange('sender_name', event.target.value)} placeholder="Como devemos assinar?" />{fieldErrors.sender_name && <FieldError messages={fieldErrors.sender_name} />}</div><div><label htmlFor="recipient_name">Nome do destinatário <span className="required">*</span></label><input id="recipient_name" required maxLength={120} value={form.recipient_name} onChange={(event) => onFieldChange('recipient_name', event.target.value)} placeholder="Quem receberá?" />{fieldErrors.recipient_name && <FieldError messages={fieldErrors.recipient_name} />}</div></div>
      <label htmlFor="message" className="message-label">Sua mensagem <span className="required">*</span></label><textarea id="message" required maxLength={10000} value={form.message} onChange={(event) => onFieldChange('message', event.target.value)} placeholder="Era uma vez uma mensagem..." rows={5} />{fieldErrors.message && <FieldError messages={fieldErrors.message} />}
    </div>
    <fieldset className="form-section courier-section"><legend><span>02</span><span><strong>Seu entregador</strong><small>Escolha quem levará a mensagem.</small></span></legend><div className="courier-options">{couriers.map((courier) => <label className={`courier-option ${form.courier === courier.code ? 'selected' : ''}`} key={courier.code}><input type="radio" name="courier" value={courier.code} checked={form.courier === courier.code} onChange={() => onFieldChange('courier', courier.code)} /><img src={courier.cardAsset} alt="" aria-hidden="true" onError={handleCourierImageError} /><span><strong>{courier.label}</strong><small>{courier.description}</small><small className="courier-motto">“{courier.motto}”</small></span></label>)}</div>{fieldErrors.courier && <FieldError messages={fieldErrors.courier} />}</fieldset>
    <div className="form-section"><div className="section-heading"><span>03</span><div><h2>Sua aventura</h2><p>Escolha onde a jornada começa, termina e quanto tempo leva.</p></div></div>
      <div className="route-fields"><div><label htmlFor="origin">De</label><select id="origin" value={form.origin} onChange={(event) => onFieldChange('origin', event.target.value)}>{locations.map((location) => <option key={location.code} value={location.code}>{location.label}</option>)}</select><LocationPreview code={form.origin} kind="origin" /></div><span className="route-arrow" aria-hidden="true">→</span><div><label htmlFor="destination">Para</label><select id="destination" value={form.destination} onChange={(event) => onFieldChange('destination', event.target.value)}>{locations.map((location) => <option key={location.code} value={location.code}>{location.label}</option>)}</select><LocationPreview code={form.destination} kind="destination" /></div></div>
      {error && <p className="error-message" role="alert">{error}</p>}{fieldErrors.origin && <FieldError messages={fieldErrors.origin} />}{fieldErrors.destination && <FieldError messages={fieldErrors.destination} />}
      <div className="duration-field"><label htmlFor="duration_minutes">Duração da viagem <small>(1 a 1440 minutos)</small></label><div className="duration-input"><input id="duration_minutes" type="number" required min={1} max={1440} value={form.duration_minutes} onChange={(event) => onFieldChange('duration_minutes', Number(event.target.value))} /><span>minutos</span></div>{fieldErrors.duration_minutes && <FieldError messages={fieldErrors.duration_minutes} />}</div>
      <DeliverySummary form={form} />
    </div>
    <button className="button primary submit-button" type="submit" disabled={submitting}>{submitting ? 'Preparando a entrega…' : 'Enviar pela Cartopia ✦'}</button>
  </form>
}
