import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { DeliverySummary } from './DeliverySummary'
import { FieldError } from './FieldError'
import { handleCourierImageError } from './courierImage'
import { LocationPicker } from './LocationPicker'
import { EndpointLocationField } from './EndpointLocationField'
import { JourneyPreview } from './JourneyPreview'
import { couriers } from '../../domain/delivery/couriers'
import { locations } from '../../domain/delivery/locations'
import type { CreateDeliveryInput, CreateDeliveryStep } from '../../domain/delivery/types'
import type { SavedLocation, SavedRecipient } from '../../services/api'
import { toggleFormSection, type FormSectionState } from '../../utils/formSections'

interface CreateDeliveryFormProps {
  form: CreateDeliveryInput
  adventureEnabled: boolean
  error: string
  fieldErrors: Record<string, string[]>
  submitting: boolean
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onFieldChange: (field: keyof CreateDeliveryInput, value: string | number) => void
  onEndpointChange: (kind: 'origin' | 'destination', location: { label: string; latitude: number; longitude: number }) => void
  onAdventureChange: (enabled: boolean) => void
  onStepChange: (index: number, field: 'title' | 'description' | 'duration_minutes', value: string | number) => void
  onStepLocationChange: (index: number, location: CreateDeliveryStep['location']) => void
  onAddStep: () => void
  onRemoveStep: (index: number) => void
  onMoveStep: (index: number, direction: -1 | 1) => void
  savedLocations: SavedLocation[]
  savedRecipients: SavedRecipient[]
  canSaveNewItems: boolean
  saveNewRecipient: boolean
  onSaveNewRecipientChange: (shouldSave: boolean) => void
  saveNewOrigin: boolean
  onSaveNewOriginChange: (shouldSave: boolean) => void
  saveNewDestination: boolean
  onSaveNewDestinationChange: (shouldSave: boolean) => void
}

export function CreateDeliveryForm({ form, adventureEnabled, error, fieldErrors, submitting, onSubmit, onFieldChange, onEndpointChange, onAdventureChange, onStepChange, onStepLocationChange, onAddStep, onRemoveStep, onMoveStep, savedLocations, savedRecipients, canSaveNewItems, saveNewRecipient, onSaveNewRecipientChange, saveNewOrigin, onSaveNewOriginChange, saveNewDestination, onSaveNewDestinationChange }: CreateDeliveryFormProps) {
  const formRef = useRef<HTMLFormElement>(null)
  const [openSections, setOpenSections] = useState<FormSectionState>({ message: true, courier: false, adventure: false })
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (!error && !Object.values(fieldErrors).some((messages) => messages.length > 0)) return

    const focusFirstInvalidField = () => {
      const firstInvalidField = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')
        ?? formRef.current?.querySelector<HTMLInputElement>('input[name="courier"]')

      firstInvalidField?.focus()
    }

    let focusFrame = 0
    const frame = window.requestAnimationFrame(() => {
      setOpenSections({ message: true, courier: true, adventure: true })
      focusFrame = window.requestAnimationFrame(focusFirstInvalidField)
    })
    return () => {
      window.cancelAnimationFrame(frame)
      window.cancelAnimationFrame(focusFrame)
    }
  }, [fieldErrors, error])

  function toggleSection(section: keyof typeof openSections) {
    setOpenSections((current) => toggleFormSection(current, section))
  }

  function openSection(section: keyof typeof openSections) {
    setOpenSections((current) => ({ ...current, [section]: true }))
    window.requestAnimationFrame(() => {
      const heading = document.getElementById(`${section}-section-heading`)
      heading?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })
      heading?.focus()
    })
  }

  function selectCourier(code: string) {
    onFieldChange('courier', code)
    openSection('adventure')
  }

  function touchField(field: string) {
    setTouchedFields((current) => ({ ...current, [field]: true }))
  }

  function selectSavedLocation(kind: 'origin' | 'destination', location: SavedLocation) {
    onEndpointChange(kind, { label: location.label, latitude: location.latitude, longitude: location.longitude })
    if (kind === 'origin') onSaveNewOriginChange(false)
    else onSaveNewDestinationChange(false)
  }

  function handleSectionKeyDown(event: KeyboardEvent<HTMLDivElement>, section: keyof typeof openSections) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      toggleSection(section)
    }
  }

  const messageComplete = Boolean(form.message.trim() && form.recipient_name.trim())
  const courierComplete = couriers.some((courier) => courier.code === form.courier)
  const stepsComplete = Boolean(
    form.steps?.length &&
    form.steps.every((step) => step.title.trim() && Number(step.duration_minutes) > 0),
  )
  const recipientError = fieldErrors.recipient_name?.[0]
    ?? (touchedFields.recipient_name && !form.recipient_name.trim() ? 'Informe o nome do destinatário.' : undefined)
  const messageError = fieldErrors.message?.[0]
    ?? (touchedFields.message && !form.message.trim() ? 'Escreva uma mensagem antes de continuar.' : undefined)
  const routeComplete = Boolean(
    form.origin_location &&
    form.destination_location &&
    Number(form.duration_minutes) > 0 &&
    Number(form.final_duration_minutes) > 0 &&
    (!adventureEnabled || stepsComplete),
  )

  return (
    <form
      ref={formRef}
      className="delivery-form"
      onSubmit={onSubmit}
      onInvalidCapture={(event) => {
        const field = event.target as HTMLInputElement
        setOpenSections({ message: true, courier: true, adventure: true })
        window.requestAnimationFrame(() => field.focus())
      }}
    >
      <nav className="form-journey" aria-label="Etapas para preparar a entrega">
        <button type="button" className={`${messageComplete ? 'completed ' : ''}${!messageComplete ? 'active' : ''}`} aria-current={!messageComplete ? 'step' : undefined} aria-controls="message-section-content" onClick={() => openSection('message')}>
          <b>{messageComplete ? '✓' : '01'}</b>
          <small>Escreva</small>
        </button>
        <i aria-hidden="true" />
        <button type="button" className={`${courierComplete ? 'completed ' : ''}${messageComplete && !courierComplete ? 'active' : ''}`} aria-current={messageComplete && !courierComplete ? 'step' : undefined} aria-controls="courier-section-content" onClick={() => openSection('courier')}>
          <b>{courierComplete ? '✓' : '02'}</b>
          <small>Entregador</small>
        </button>
        <i aria-hidden="true" />
        <button type="button" className={`${routeComplete ? 'completed ' : ''}${messageComplete && courierComplete && !routeComplete ? 'active' : ''}`} aria-current={messageComplete && courierComplete && !routeComplete ? 'step' : undefined} aria-controls="adventure-section-content" onClick={() => openSection('adventure')}>
          <b>{routeComplete ? '✓' : '03'}</b>
          <small>Trace a rota</small>
        </button>
      </nav>
      <div className={`form-section form-collapsible ${openSections.message ? 'is-open' : ''}`}>
        <div id="message-section-heading" className="section-heading" role="button" tabIndex={0} aria-expanded={openSections.message} aria-controls="message-section-content" onClick={() => toggleSection('message')} onKeyDown={(event) => handleSectionKeyDown(event, 'message')}>
          <span>01</span>
          <div>
            <h2>Sua mensagem</h2>
            <p>Escreva a carta e conte-nos quem vai recebê-la.</p>
          </div>
          <b className="section-toggle-icon" aria-hidden="true">{openSections.message ? '−' : '+'}</b>
        </div>
        <div id="message-section-content">
        <div className="field-grid">
          <div>
            <label htmlFor="sender_name">Seu nome <small>(opcional)</small></label>
            <input id="sender_name" maxLength={120} value={form.sender_name} aria-invalid={fieldErrors.sender_name ? true : undefined} aria-describedby={fieldErrors.sender_name ? 'sender-name-error' : undefined} onChange={(event) => onFieldChange('sender_name', event.target.value)} placeholder="Como devemos assinar?" />
            {fieldErrors.sender_name && <FieldError id="sender-name-error" messages={fieldErrors.sender_name} />}
          </div>
          <div>
            <label htmlFor="recipient_name">Nome do destinatário <span className="required">*</span></label>
            <input id="recipient_name" required maxLength={120} value={form.recipient_name} aria-invalid={recipientError ? true : undefined} aria-describedby={recipientError ? 'recipient-name-error' : undefined} onBlur={() => touchField('recipient_name')} onChange={(event) => onFieldChange('recipient_name', event.target.value)} placeholder="Quem receberá?" />
            {savedRecipients.length > 0 && <select className="saved-recipient-select" aria-label="Usar destinatário salvo" defaultValue="" onChange={(event) => { const recipient = savedRecipients.find((item) => String(item.id) === event.target.value); if (recipient) { onFieldChange('recipient_name', recipient.name); onFieldChange('recipient_email', recipient.email ?? ''); onSaveNewRecipientChange(false) } event.currentTarget.value = '' }}><option value="">Usar destinatário salvo…</option>{savedRecipients.map((recipient) => <option key={recipient.id} value={recipient.id}>{recipient.nickname ? `${recipient.nickname} · ${recipient.name}` : recipient.name}</option>)}</select>}
            <label className="recipient-email-field" htmlFor="recipient_email">E-mail <small>(opcional, para aparecer na conta da pessoa)</small></label>
            <input id="recipient_email" type="email" maxLength={255} value={form.recipient_email ?? ''} onChange={(event) => onFieldChange('recipient_email', event.target.value)} placeholder="nome@exemplo.com" />
            {canSaveNewItems && !savedRecipients.some((recipient) => recipient.name.toLowerCase() === form.recipient_name.trim().toLowerCase() && (recipient.email ?? '').toLowerCase() === (form.recipient_email ?? '').trim().toLowerCase()) && form.recipient_name.trim() && <label className="save-new-option"><input type="checkbox" checked={saveNewRecipient} onChange={(event) => onSaveNewRecipientChange(event.target.checked)} /><span>Salvar esta pessoa na minha conta</span></label>}
            {recipientError && <FieldError id="recipient-name-error" messages={[recipientError]} />}
          </div>
        </div>
        <div className="message-composer">
          <div className="message-composer-heading">
            <label htmlFor="message" className="message-label">Sua mensagem <span className="required">*</span></label>
            <span>o coração da viagem</span>
          </div>
          <textarea id="message" required maxLength={10000} value={form.message} aria-invalid={messageError ? true : undefined} aria-describedby={messageError ? 'message-error' : undefined} onBlur={() => touchField('message')} onChange={(event) => onFieldChange('message', event.target.value)} placeholder="Era uma vez uma mensagem..." rows={5} />
          <div className="message-composer-footer">
            <span>Escreva do seu jeito.</span>
            <small>{form.message.length.toLocaleString('pt-BR')} / 10.000</small>
          </div>
          {messageError && <FieldError id="message-error" messages={[messageError]} />}
        </div>
        </div>
      </div>
      <div className={`form-section form-collapsible ${openSections.courier ? 'is-open' : ''}`}>
        <div id="courier-section-heading" className="section-heading" role="button" tabIndex={0} aria-expanded={openSections.courier} aria-controls="courier-section-content" onClick={() => toggleSection('courier')} onKeyDown={(event) => handleSectionKeyDown(event, 'courier')}>
          <span>02</span>
          <div>
            <h2>Seu entregador</h2>
            <p>Escolha quem levará a mensagem.</p>
          </div>
          <b className="section-toggle-icon" aria-hidden="true">{openSections.courier ? '−' : '+'}</b>
        </div>
        <div id="courier-section-content" className="courier-options" aria-describedby={fieldErrors.courier ? 'courier-error' : undefined}>
          {couriers.map((courier) => (
            <label className={`courier-option ${form.courier === courier.code ? 'selected' : ''}`} key={courier.code}>
              <input type="radio" name="courier" value={courier.code} checked={form.courier === courier.code} onChange={() => selectCourier(courier.code)} />
              <img src={courier.cardAsset} alt="" aria-hidden="true" onError={handleCourierImageError} />
              <span>
                <strong>{courier.label}</strong>
                <small>{courier.description}</small>
                <small className="courier-motto">“{courier.motto}”</small>
              </span>
            </label>
          ))}
        </div>
        {fieldErrors.courier && <FieldError id="courier-error" messages={fieldErrors.courier} />}
      </div>
      <div className={`form-section form-collapsible ${openSections.adventure ? 'is-open' : ''}`}>
        <div id="adventure-section-heading" className="section-heading" role="button" tabIndex={0} aria-expanded={openSections.adventure} aria-controls="adventure-section-content" onClick={() => toggleSection('adventure')} onKeyDown={(event) => handleSectionKeyDown(event, 'adventure')}>
          <span>03</span>
          <div>
            <h2>Sua aventura</h2>
            <p>Escolha onde a jornada começa, termina e quanto tempo leva.</p>
          </div>
          <b className="section-toggle-icon" aria-hidden="true">{openSections.adventure ? '−' : '+'}</b>
        </div>
        <div id="adventure-section-content">
        <fieldset className="journey-choice">
          <legend>Como sua mensagem deve viajar?</legend>
          <label className={`journey-choice-option ${!adventureEnabled ? 'selected' : ''}`}>
            <input type="radio" name="journey_mode" checked={!adventureEnabled} onChange={() => onAdventureChange(false)} />
            <span><strong>Entrega direta</strong><small>Vai direto ao destinatário.</small></span>
          </label>
          <label className={`journey-choice-option ${adventureEnabled ? 'selected' : ''}`}>
            <input type="radio" name="journey_mode" checked={adventureEnabled} onChange={() => onAdventureChange(true)} />
            <span><strong>Criar uma aventura</strong><small>Adicione paradas, histórias e lugares pelo caminho.</small></span>
          </label>
        </fieldset>
        {adventureEnabled && (
          <fieldset className="journey-visibility">
            <legend>O que o destinatário descobrirá?</legend>
            <label className={`journey-choice-option ${form.route_visibility === 'full' ? 'selected' : ''}`}>
              <input type="radio" name="route_visibility" checked={form.route_visibility === 'full'} onChange={() => onFieldChange('route_visibility', 'full')} />
              <span><strong>Mostrar toda a trajetória</strong><small>O destinatário vê todas as paradas desde o início.</small></span>
            </label>
            <label className={`journey-choice-option ${form.route_visibility === 'progressive' ? 'selected' : ''}`}>
              <input type="radio" name="route_visibility" checked={form.route_visibility === 'progressive'} onChange={() => onFieldChange('route_visibility', 'progressive')} />
              <span><strong>Revelar pelo caminho</strong><small>Cada nova etapa aparece conforme a entrega avança.</small></span>
            </label>
          </fieldset>
        )}
        <div className="route-fields">
          <EndpointLocationField label="De" location={form.origin_location} fallback={locations[0]} savedLocations={savedLocations} onSavedLocation={(location) => selectSavedLocation('origin', location)} onChange={(location) => onEndpointChange('origin', location)} canSave={canSaveNewItems} saveNewLocation={saveNewOrigin} onSaveNewLocationChange={onSaveNewOriginChange} />
          <span className="route-arrow" aria-hidden="true">→</span>
          <EndpointLocationField label="Para" location={form.destination_location} fallback={locations[1]} savedLocations={savedLocations} onSavedLocation={(location) => selectSavedLocation('destination', location)} onChange={(location) => onEndpointChange('destination', location)} canSave={canSaveNewItems} saveNewLocation={saveNewDestination} onSaveNewLocationChange={onSaveNewDestinationChange} />
        </div>
        {!adventureEnabled && (
          <div className="duration-field">
            <label htmlFor="duration_minutes">Duração da viagem <small>(1 a 1440 minutos)</small></label>
            <div className="duration-presets" aria-label="Durações sugeridas">
              {[15, 60, 1440].map((minutes) => (
                <button
                  key={minutes}
                  type="button"
                  className="button secondary"
                  aria-pressed={form.duration_minutes === minutes}
                  onClick={() => onFieldChange('duration_minutes', minutes)}
                >
                  {minutes === 15 ? '15 min' : minutes === 60 ? '1 hora' : '24 horas'}
                </button>
              ))}
            </div>
            <div className="duration-input">
              <input id="duration_minutes" type="number" required min={1} max={1440} value={form.duration_minutes} aria-invalid={fieldErrors.duration_minutes ? true : undefined} aria-describedby={fieldErrors.duration_minutes ? 'duration-minutes-error' : undefined} onChange={(event) => onFieldChange('duration_minutes', Number(event.target.value))} />
              <span>minutos</span>
            </div>
            {fieldErrors.duration_minutes && <FieldError id="duration-minutes-error" messages={fieldErrors.duration_minutes} />}
          </div>
        )}
        {adventureEnabled && <div className="steps-editor">
          <div className="steps-editor-heading"><div><label>Paradas da aventura</label><small>Defina o tempo desde o ponto anterior até cada parada.</small></div><span>{(form.steps ?? []).length} {(form.steps ?? []).length === 1 ? 'parada' : 'paradas'}</span></div>
          {!(form.steps ?? []).length && <div className="steps-empty"><strong>Sua aventura ainda não tem paradas.</strong><p>Adicione uma história, uma pausa ou um lugar especial ao caminho.</p></div>}
          {(form.steps ?? []).map((step, index) => <article className="step-editor" key={step.id ?? index}><div className="step-editor-number">{String(index + 1).padStart(2, '0')}</div><div className="step-editor-fields"><div className="step-editor-heading-row"><strong>Parada {index + 1}</strong><div className="step-reorder"><button type="button" className="step-order-button" disabled={index === 0} aria-label={`Mover parada ${index + 1} para cima`} onClick={() => onMoveStep(index, -1)}>↑ subir</button><button type="button" className="step-order-button" disabled={index === (form.steps ?? []).length - 1} aria-label={`Mover parada ${index + 1} para baixo`} onClick={() => onMoveStep(index, 1)}>↓ descer</button></div></div><input required maxLength={120} aria-label={`Título da etapa ${index + 1}`} value={step.title} onChange={(event) => onStepChange(index, 'title', event.target.value)} placeholder="Ex.: Uma pausa para um croissant" /><textarea maxLength={500} aria-label={`Descrição da etapa ${index + 1}`} value={step.description ?? ''} onChange={(event) => onStepChange(index, 'description', event.target.value)} placeholder="Descreva esse momento da jornada (opcional)." rows={2} /><div className="step-duration"><label htmlFor={`step-duration-${index}`}>Tempo até esta parada</label><input id={`step-duration-${index}`} required type="number" min={1} max={1440} value={step.duration_minutes} onChange={(event) => onStepChange(index, 'duration_minutes', Number(event.target.value))} /><span>minutos</span>{<button type="button" className="text-button" onClick={() => onRemoveStep(index)}>remover</button>}</div><LocationPicker center={form.origin_location ? [form.origin_location.longitude, form.origin_location.latitude] : locations[0].coordinates} location={step.location} onChange={(location) => onStepLocationChange(index, location)} onClear={() => onStepLocationChange(index, undefined)} /></div></article>)}
          <button type="button" className="text-button" onClick={onAddStep}>+ adicionar parada</button>
          <div className="final-destination-duration"><label htmlFor="final_duration_minutes">Tempo da última parada até o destino final</label><div className="duration-input"><input id="final_duration_minutes" type="number" required min={1} max={1440} value={form.final_duration_minutes} onChange={(event) => onFieldChange('final_duration_minutes', Number(event.target.value))} /><span>minutos</span></div></div>
          {form.origin_location && form.destination_location ? <JourneyPreview origin={form.origin_location} destination={form.destination_location} steps={form.steps ?? []} finalDurationMinutes={form.final_duration_minutes} /> : <p className="steps-empty">Escolha a origem e o destino para visualizar a prévia do percurso.</p>}
        </div>}
        {error && <p className="error-message" role="alert">{error}</p>}
        {fieldErrors.origin && <FieldError messages={fieldErrors.origin} />}
        {fieldErrors.destination && <FieldError messages={fieldErrors.destination} />}
        {fieldErrors.steps && <FieldError messages={fieldErrors.steps} />}
        </div>
      </div>
      <div className="mobile-review">
        <DeliverySummary form={{ ...form, steps: adventureEnabled ? form.steps : [] }} />
      </div>
      <p>A mensagem será revelada ao final da viagem. Depois de enviar, compartilhe o link com o destinatário.</p>
      <button className="button primary submit-button" type="submit" disabled={submitting}>
        {submitting ? 'Selando a carta…' : 'Enviar carta ✦'}
      </button>
    </form>
  )
}
