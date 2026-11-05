import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { DeliverySummary } from './DeliverySummary'
import { FieldError } from './FieldError'
import { handleCourierImageError } from './courierImage'
import { LocationPicker } from './LocationPicker'
import { EndpointLocationField } from './EndpointLocationField'
import { JourneyPreview } from './JourneyPreview'
import { couriers } from '../../domain/delivery/couriers'
import { locations } from '../../domain/delivery/locations'
import type { CreateDeliveryInput, CreateDeliveryStep, DestinationSource } from '../../domain/delivery/types'
import type { RecipientDeliveryOptions, SavedLocation, SavedRecipient } from '../../services/api'
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
  onDeliveryModeChange: (mode: 'real' | 'playful') => void
  onUnlockTypeChange: (type: 'none' | 'password' | 'hangman') => void
  onStepChange: (index: number, field: 'title' | 'description' | 'arrival_at', value: string) => void
  onStepLocationChange: (index: number, location: CreateDeliveryStep['location']) => void
  onAddStep: () => void
  onRemoveStep: (index: number) => void
  onMoveStep: (index: number, direction: -1 | 1) => void
  savedLocations: SavedLocation[]
  savedRecipients: SavedRecipient[]
  recipientOptions: RecipientDeliveryOptions | null
  onCheckRecipientOptions: (email?: string) => void
  onDestinationSourceChange: (source: DestinationSource) => void
  canSaveNewItems: boolean
  saveNewRecipient: boolean
  onSaveNewRecipientChange: (shouldSave: boolean) => void
  saveNewOrigin: boolean
  onSaveNewOriginChange: (shouldSave: boolean) => void
  saveNewDestination: boolean
  onSaveNewDestinationChange: (shouldSave: boolean) => void
}

function toLocalDateTimeInput(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function CreateDeliveryForm({ form, adventureEnabled, error, fieldErrors, submitting, onSubmit, onFieldChange, onEndpointChange, onAdventureChange, onDeliveryModeChange, onUnlockTypeChange, onStepChange, onStepLocationChange, onAddStep, onRemoveStep, onMoveStep, savedLocations, savedRecipients, recipientOptions, onCheckRecipientOptions, onDestinationSourceChange, canSaveNewItems, saveNewRecipient, onSaveNewRecipientChange, saveNewOrigin, onSaveNewOriginChange, saveNewDestination, onSaveNewDestinationChange }: CreateDeliveryFormProps) {
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
    form.steps.every((step, index) => {
      const arrival = new Date(step.arrival_at ?? '')
      const previousArrival = index === 0 ? Date.now() : new Date(form.steps?.[index - 1]?.arrival_at ?? '').getTime()
      return step.title.trim() && !Number.isNaN(arrival.getTime()) && arrival.getTime() > previousArrival
    }),
  )
  const arrivalAt = new Date(form.arrival_at ?? '')
  const arrivalAtComplete = Boolean(
    form.arrival_at &&
    !Number.isNaN(arrivalAt.getTime()) &&
    arrivalAt.getTime() > Date.now(),
  )
  const recipientError = fieldErrors.recipient_name?.[0]
    ?? (touchedFields.recipient_name && !form.recipient_name.trim() ? 'Informe o nome do destinatário.' : undefined)
  const messageError = fieldErrors.message?.[0]
    ?? (touchedFields.message && !form.message.trim() ? 'Escreva uma mensagem antes de continuar.' : undefined)
  const emailError = fieldErrors.recipient_email?.[0]
  const lastStepArrival = form.steps?.length
    ? new Date(form.steps[form.steps.length - 1].arrival_at ?? '')
    : null
  const adventureFinalDuration = arrivalAtComplete && lastStepArrival && !Number.isNaN(lastStepArrival.getTime())
    ? Math.ceil((arrivalAt.getTime() - lastStepArrival.getTime()) / 60000)
    : 0
  const adventureDuration = arrivalAtComplete
    ? Math.ceil((arrivalAt.getTime() - Date.now()) / 60000)
    : 0
  const routeComplete = Boolean(
    form.origin_location &&
    (form.destination_source !== 'specific' || form.destination_location) &&
    arrivalAtComplete &&
    (!adventureEnabled || (stepsComplete && adventureFinalDuration > 0)),
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
        <div id="message-section-content" className="message-section-content">
          <div className="message-details-groups">
          <section className="message-group" aria-labelledby="sender-group-title">
            <div className="message-group-heading">
              <div>
                <span className="message-group-kicker">Grupo 01</span>
                <h3 id="sender-group-title">De quem é a carta?</h3>
              </div>
            </div>
            <label htmlFor="sender_name">
              Seu nome <small>(opcional)</small>
            </label>
            <input
              id="sender_name"
              maxLength={120}
              value={form.sender_name}
              aria-invalid={fieldErrors.sender_name ? true : undefined}
              aria-describedby={fieldErrors.sender_name ? 'sender-name-error' : undefined}
              onBlur={() => touchField('sender_name')}
              onChange={(event) => onFieldChange('sender_name', event.target.value)}
              placeholder="Como devemos assinar?"
            />
            {fieldErrors.sender_name && (
              <FieldError id="sender-name-error" messages={fieldErrors.sender_name} />
            )}
          </section>
          <section className="message-group" aria-labelledby="recipient-group-title">
            <div className="message-group-heading">
              <div>
                <span className="message-group-kicker">Grupo 02</span>
                <h3 id="recipient-group-title">Para quem vai a carta?</h3>
              </div>
              {savedRecipients.length > 0 ? (
                <label className="saved-recipient-action">
                  <span>Usar destinatário salvo</span>
                  <select
                    aria-label="Usar destinatário salvo"
                    defaultValue=""
                    onChange={(event) => {
                      const recipient = savedRecipients.find(
                        (item) => String(item.id) === event.target.value,
                      )

                      if (recipient) {
                        onFieldChange('recipient_name', recipient.name)
                        onFieldChange('recipient_email', recipient.email ?? '')
                        onSaveNewRecipientChange(false)
                        onDestinationSourceChange('specific')
                        onCheckRecipientOptions(recipient.email ?? '')
                      } else {
                        onDestinationSourceChange('specific')
                        onCheckRecipientOptions('')
                      }

                      event.currentTarget.value = ''
                    }}
                  >
                    <option value="">Selecionar</option>
                    {savedRecipients.map((recipient) => (
                      <option key={recipient.id} value={recipient.id}>
                        {recipient.nickname
                          ? `${recipient.nickname} · ${recipient.name}`
                          : recipient.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>
            <label htmlFor="recipient_name">
              Nome do destinatário <span className="required">*</span>
            </label>
            <input
              id="recipient_name"
              required
              maxLength={120}
              value={form.recipient_name}
              aria-invalid={recipientError ? true : undefined}
              aria-describedby={recipientError ? 'recipient-name-error' : undefined}
              onBlur={() => touchField('recipient_name')}
              onChange={(event) => onFieldChange('recipient_name', event.target.value)}
              placeholder="Nome de quem vai receber"
            />
            <label className="recipient-email-field" htmlFor="recipient_email">
              E-mail <small>(opcional)</small>
            </label>
            <input
              id="recipient_email"
              type="email"
              maxLength={255}
              value={form.recipient_email ?? ''}
              aria-invalid={emailError ? true : undefined}
              aria-describedby={emailError ? 'recipient-email-error' : 'recipient-email-help'}
              onBlur={() => onCheckRecipientOptions()}
              onChange={(event) => {
                onFieldChange('recipient_email', event.target.value)
                onDestinationSourceChange('specific')
              }}
              placeholder="exemplo@email.com"
            />
            <p id="recipient-email-help" className="field-help">
              Opcional. Permite associar a carta à conta Cartopia do destinatário, quando disponível.
            </p>
            {emailError ? (
              <FieldError id="recipient-email-error" messages={[emailError]} />
            ) : null}
            {form.delivery_mode === 'real' && recipientOptions?.available && (
              <fieldset className="recipient-destination-options">
                <legend>Destino para este destinatário</legend>
                <label className={form.destination_source === 'specific' ? 'journey-choice-option selected' : 'journey-choice-option'}>
                  <input type="radio" name="destination_source" checked={form.destination_source === 'specific'} onChange={() => onDestinationSourceChange('specific')} />
                  <span><strong>Escolher um lugar específico</strong><small>Defina o destino desta carta agora.</small></span>
                </label>
                {recipientOptions.recipient_default_available && (
                  <label className={form.destination_source === 'recipient_default' ? 'journey-choice-option selected' : 'journey-choice-option'}>
                    <input type="radio" name="destination_source" checked={form.destination_source === 'recipient_default'} onChange={() => onDestinationSourceChange('recipient_default')} />
                    <span><strong>Endereço padrão do destinatário</strong><small>O endereço fica protegido e é resolvido pela conta.</small></span>
                  </label>
                )}
                {recipientOptions.contact_preference_available && (
                  <label className={form.destination_source === 'contact_preference' ? 'journey-choice-option selected' : 'journey-choice-option'}>
                    <input type="radio" name="destination_source" checked={form.destination_source === 'contact_preference'} onChange={() => onDestinationSourceChange('contact_preference')} />
                    <span><strong>Preferência salva para você</strong><small>Usar a configuração que esta pessoa deixou para seu contato.</small></span>
                  </label>
                )}
              </fieldset>
            )}
            {canSaveNewItems && !savedRecipients.some((recipient) => recipient.name.toLowerCase() === form.recipient_name.trim().toLowerCase() && (recipient.email ?? '').toLowerCase() === (form.recipient_email ?? '').trim().toLowerCase()) && form.recipient_name.trim() && (
              <label className="save-new-option">
                <input
                  type="checkbox"
                  checked={saveNewRecipient}
                  onChange={(event) => onSaveNewRecipientChange(event.target.checked)}
                />
                <span>Salvar esta pessoa na minha conta</span>
              </label>
            )}
            {recipientError && (
              <FieldError id="recipient-name-error" messages={[recipientError]} />
            )}
            </section>
          </div>
          <div className="message-composer">
            <div className="message-composer-heading">
              <div>
                <span className="message-group-kicker">Grupo 03</span>
                <label htmlFor="message" className="message-label">
                  Escreva sua carta <span className="required">*</span>
                </label>
              </div>
              <span>O coração da viagem</span>
            </div>
            <textarea
              id="message"
              required
              maxLength={10000}
              value={form.message}
              aria-invalid={messageError ? true : undefined}
              aria-describedby={messageError ? 'message-error' : undefined}
              onBlur={() => touchField('message')}
              onChange={(event) => onFieldChange('message', event.target.value)}
              placeholder="Querido(a)..."
              rows={7}
            />
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
          <legend>Como sua carta vai viajar?</legend>
          <label className={`journey-choice-option ${!adventureEnabled ? 'selected' : ''}`}>
            <input type="radio" name="journey_mode" checked={!adventureEnabled} onChange={() => onAdventureChange(false)} />
            <span><strong>Entrega direta</strong><small>A carta viaja até o destino, sem paradas intermediárias.</small></span>
          </label>
          <label className={`journey-choice-option ${adventureEnabled ? 'selected' : ''}`}>
            <input type="radio" name="journey_mode" checked={adventureEnabled} onChange={() => onAdventureChange(true)} />
            <span><strong>Criar uma aventura</strong><small>Crie paradas pelo caminho e transforme a entrega em uma história.</small></span>
          </label>
        </fieldset>
        <fieldset className="journey-choice">
          <legend>Por onde sua carta vai passar?</legend>
          <label className={`journey-choice-option ${form.delivery_mode === 'real' ? 'selected' : ''}`}>
            <input type="radio" name="delivery_mode" checked={form.delivery_mode === 'real'} onChange={() => onDeliveryModeChange('real')} />
            <span><strong>Locais reais</strong><small>Escolha endereços reais e acompanhe o percurso no mapa.</small></span>
          </label>
          <label className={`journey-choice-option ${form.delivery_mode === 'playful' ? 'selected' : ''}`}>
            <input type="radio" name="delivery_mode" checked={form.delivery_mode === 'playful'} onChange={() => onDeliveryModeChange('playful')} />
            <span><strong>Locais lúdicos</strong><small>Invente lugares e crie uma viagem imaginária, sem mapa.</small></span>
          </label>
        </fieldset>
        <section className="route-configuration" aria-labelledby="route-configuration-title">
          <div className="journey-group-heading">
            <h3 id="route-configuration-title">Escolha o percurso</h3>
            <p>{form.delivery_mode === 'real' ? 'Informe onde a carta começa e termina.' : 'Conte onde a viagem imaginária começa e termina.'}</p>
          </div>
          <div className="route-fields">
            {form.delivery_mode === 'playful' ? (
              <div className="endpoint-location-field">
                <label htmlFor="playful-origin">Origem</label>
                <input id="playful-origin" maxLength={160} required value={form.origin} onChange={(event) => onFieldChange('origin', event.target.value)} placeholder="Ex.: Nárnia" />
                <small>Um reino, uma lembrança ou um sentimento.</small>
              </div>
            ) : (
              <EndpointLocationField label="Origem" location={form.origin_location} fallback={locations[0]} savedLocations={savedLocations} onSavedLocation={(location) => selectSavedLocation('origin', location)} onChange={(location) => onEndpointChange('origin', location)} canSave={canSaveNewItems} saveNewLocation={saveNewOrigin} onSaveNewLocationChange={onSaveNewOriginChange} />
            )}
            <span className="route-arrow" aria-hidden="true">→</span>
            {form.delivery_mode === 'playful' ? (
              <div className="endpoint-location-field">
                <label htmlFor="playful-destination">Destino</label>
                <input id="playful-destination" maxLength={160} required value={form.destination} onChange={(event) => onFieldChange('destination', event.target.value)} placeholder="Ex.: O seu coração" />
                <small>Um lugar impossível ou alguém especial.</small>
              </div>
            ) : form.destination_source === 'specific' ? (
              <EndpointLocationField label="Destino" location={form.destination_location} fallback={locations[1]} savedLocations={savedLocations} onSavedLocation={(location) => selectSavedLocation('destination', location)} onChange={(location) => onEndpointChange('destination', location)} canSave={canSaveNewItems} saveNewLocation={saveNewDestination} onSaveNewLocationChange={onSaveNewDestinationChange} />
            ) : (
              <div className="endpoint-location-field recipient-destination-confirmation">
                <label>Destino</label>
                <strong>Endereço protegido do destinatário</strong>
                <p>O local será resolvido no momento do envio e não será exibido aqui.</p>
              </div>
            )}
          </div>
          {form.delivery_mode === 'real' && recipientOptions?.available && (
            <p className="field-help route-context-help">Você também pode usar o endereço protegido ou uma preferência salva do destinatário.</p>
          )}
          {adventureEnabled && (
            <fieldset className="journey-visibility">
              <legend>Visibilidade das paradas</legend>
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
          {!adventureEnabled && (
            <div className="duration-field journey-duration-field">
              <label htmlFor="arrival_at">Quando a mensagem deve chegar?</label>
              <p className="field-help">Escolha a data e a hora no seu horário local. A duração da viagem será calculada automaticamente.</p>
              <input
                id="arrival_at"
                type="datetime-local"
                required
                min={toLocalDateTimeInput(new Date())}
                value={form.arrival_at ?? ''}
                aria-invalid={fieldErrors.arrival_at ? true : undefined}
                aria-describedby={fieldErrors.arrival_at ? 'arrival-at-error' : 'arrival-at-help'}
                onChange={(event) => onFieldChange('arrival_at', event.target.value)}
              />
              <small id="arrival-at-help" className="field-help">O horário será interpretado conforme o fuso deste dispositivo.</small>
              {fieldErrors.arrival_at && <FieldError id="arrival-at-error" messages={fieldErrors.arrival_at} />}
            </div>
          )}
          {adventureEnabled && <div className="steps-editor">
            <div className="journey-duration-overview">
              <div>
                <strong>Quanto tempo a viagem vai durar?</strong>
                <p>Defina quanto tempo a carta ficará em viagem antes de chegar ao destino. A duração total soma cada parada e o trecho final.</p>
              </div>
              <strong>{adventureDuration > 0 ? `${adventureDuration} minutos` : 'Ainda não definida'}</strong>
            </div>
            <div className="steps-editor-heading"><div><label>Paradas da aventura</label><small>Defina o tempo desde o ponto anterior até cada parada.</small></div><span>{(form.steps ?? []).length} {(form.steps ?? []).length === 1 ? 'parada' : 'paradas'}</span></div>
            {!(form.steps ?? []).length && <div className="steps-empty"><strong>Sua aventura ainda não tem paradas.</strong><p>Adicione uma história, uma pausa ou um lugar especial ao caminho.</p></div>}
            {(form.steps ?? []).map((step, index) => {
              const previousArrival = index === 0 ? new Date() : new Date(form.steps?.[index - 1]?.arrival_at ?? '')
              return (
                <article className="step-editor" key={step.id ?? index}>
                  <div className="step-editor-number">{String(index + 1).padStart(2, '0')}</div>
                  <div className="step-editor-fields">
                    <div className="step-editor-heading-row">
                      <strong>Parada {index + 1}</strong>
                      <div className="step-reorder">
                        <button type="button" className="step-order-button" disabled={index === 0} aria-label={`Mover parada ${index + 1} para cima`} onClick={() => onMoveStep(index, -1)}>↑ subir</button>
                        <button type="button" className="step-order-button" disabled={index === (form.steps ?? []).length - 1} aria-label={`Mover parada ${index + 1} para baixo`} onClick={() => onMoveStep(index, 1)}>↓ descer</button>
                      </div>
                    </div>
                    <input required maxLength={120} aria-label={`Título da etapa ${index + 1}`} value={step.title} onChange={(event) => onStepChange(index, 'title', event.target.value)} placeholder="Ex.: Uma pausa para um croissant" />
                    <textarea maxLength={500} aria-label={`Descrição da etapa ${index + 1}`} value={step.description ?? ''} onChange={(event) => onStepChange(index, 'description', event.target.value)} placeholder="Descreva esse momento da jornada (opcional)." rows={2} />
                    <div className="step-duration">
                      <label htmlFor={`step-arrival-${index}`}>Quando chega nesta parada?</label>
                      <input id={`step-arrival-${index}`} required type="datetime-local" min={toLocalDateTimeInput(previousArrival)} value={step.arrival_at ?? ''} onChange={(event) => onStepChange(index, 'arrival_at', event.target.value)} />
                      <small className="field-help">O horário será interpretado conforme o fuso deste dispositivo.</small>
                      <button type="button" className="text-button" onClick={() => onRemoveStep(index)}>remover</button>
                    </div>
                    {form.delivery_mode === 'real' && <LocationPicker center={form.origin_location ? [form.origin_location.longitude, form.origin_location.latitude] : locations[0].coordinates} location={step.location} onChange={(location) => onStepLocationChange(index, location)} onClear={() => onStepLocationChange(index, undefined)} />}
                  </div>
                </article>
              )
            })}
            <button type="button" className="text-button" onClick={onAddStep}>+ adicionar parada</button>
            <div className="duration-field journey-duration-field">
              <label htmlFor="adventure-arrival_at">Quando a mensagem deve chegar?</label>
              <p className="field-help">O último trecho será calculado automaticamente depois das paradas.</p>
              <input
                id="adventure-arrival_at"
                type="datetime-local"
                required
                min={toLocalDateTimeInput(new Date())}
                value={form.arrival_at ?? ''}
                aria-invalid={fieldErrors.arrival_at ? true : undefined}
                aria-describedby={fieldErrors.arrival_at ? 'adventure-arrival-at-error' : 'adventure-arrival-at-help'}
                onChange={(event) => onFieldChange('arrival_at', event.target.value)}
              />
              <small id="adventure-arrival-at-help" className="field-help">O horário será interpretado conforme o fuso deste dispositivo.</small>
              {fieldErrors.arrival_at && <FieldError id="adventure-arrival-at-error" messages={fieldErrors.arrival_at} />}
            </div>
            {form.delivery_mode === 'real' && form.origin_location && form.destination_location ? <JourneyPreview origin={form.origin_location} destination={form.destination_location} steps={form.steps ?? []} finalDurationMinutes={form.final_duration_minutes ?? 0} /> : <p className="steps-empty">{form.delivery_mode === 'real' ? 'A prévia do mapa aparece quando origem e destino forem escolhidos diretamente.' : 'Locais lúdicos não usam mapa: a história aparece pelos nomes e descrições das paradas.'}</p>}
          </div>}
        </section>
        <fieldset className="journey-choice unlock-choice">
          <legend>Como o destinatário vai abrir a carta?</legend>
          <p className="field-help">Após a chegada, escolha como sua mensagem poderá ser revelada.</p>
          <label className={`journey-choice-option ${form.unlock_type === 'none' ? 'selected' : ''}`}>
            <input type="radio" name="unlock_type" checked={form.unlock_type === 'none'} onChange={() => onUnlockTypeChange('none')} />
            <span><strong>Abrir normalmente</strong><small>A mensagem poderá ser lida assim que a carta chegar.</small></span>
          </label>
          <label className={`journey-choice-option ${form.unlock_type === 'password' ? 'selected' : ''}`}>
            <input type="radio" name="unlock_type" checked={form.unlock_type === 'password'} onChange={() => onUnlockTypeChange('password')} />
            <span><strong>Proteger com senha</strong><small>O destinatário precisará informar uma senha para ler a mensagem.</small></span>
          </label>
          <label className={`journey-choice-option ${form.unlock_type === 'hangman' ? 'selected' : ''}`}>
            <input type="radio" name="unlock_type" checked={form.unlock_type === 'hangman'} onChange={() => onUnlockTypeChange('hangman')} />
            <span><strong>Jogo da forca</strong><small>O destinatário deverá descobrir uma palavra para revelar a mensagem.</small></span>
          </label>
          {form.unlock_type === 'password' ? (
            <div className="conditional-unlock-field">
              <label htmlFor="unlock-password">Senha da carta</label>
              <input id="unlock-password" required maxLength={120} type="password" value={form.unlock_password ?? ''} onChange={(event) => onFieldChange('unlock_password', event.target.value)} placeholder="Digite uma senha para compartilhar" />
            </div>
          ) : null}
          {form.unlock_type === 'hangman' ? (
            <div className="conditional-unlock-field">
              <label htmlFor="unlock-hangman-word">Palavra secreta</label>
              <input id="unlock-hangman-word" required maxLength={120} value={form.unlock_password ?? ''} onChange={(event) => onFieldChange('unlock_password', event.target.value)} placeholder="Ex.: Nárnia" />
            </div>
          ) : null}
        </fieldset>
        {error && <p className="error-message" role="alert">{error}</p>}
        {fieldErrors.origin && <FieldError messages={fieldErrors.origin} />}
        {fieldErrors.destination && <FieldError messages={fieldErrors.destination} />}
        {fieldErrors.steps && <FieldError messages={fieldErrors.steps} />}
        </div>
      </div>
      <div className="mobile-review">
        <DeliverySummary form={{ ...form, steps: adventureEnabled ? form.steps : [] }} adventureEnabled={adventureEnabled} />
      </div>
      <p>A mensagem será revelada ao final da viagem. Depois de enviar, compartilhe o link com o destinatário.</p>
      <button className="button primary submit-button" type="submit" disabled={submitting}>
        {submitting ? 'Selando a carta…' : 'Enviar carta ✦'}
      </button>
    </form>
  )
}
