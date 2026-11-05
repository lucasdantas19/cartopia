import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { ApiError, createDelivery, fetchRecipientDeliveryOptions, fetchSavedItems, getAuthToken, saveLocation, saveRecipient, type RecipientDeliveryOptions, type SavedLocation, type SavedRecipient } from '../services/api'
import { createShareUrl } from '../services/accessToken'
import { copyText } from '../utils/clipboard'
import { CreateDeliveryForm } from '../components/delivery/CreateDeliveryForm'
import { DeliverySummary } from '../components/delivery/DeliverySummary'
import { DeliveryCreationSuccess } from '../components/delivery/DeliveryCreationSuccess'
import { Shell } from '../components/layout/Shell'
import type { AccessRole, CreateDeliveryInput, CreateDeliveryStep, DeliveryMode, DestinationSource, UnlockType } from '../domain/delivery/types'

interface CreatePageProps {
  onTrack: (publicId: string, token: string, role?: AccessRole) => void
  onHome: () => void
  onPrivacy: () => void
  onAccount: () => void
}

interface CreatedDelivery {
  publicId: string
  recipientUrl: string
  senderUrl: string
  recipientToken: string
  senderToken: string
}

const createdDeliveryStorageKey = 'cartopia.created_delivery'

function toLocalDateTimeInput(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function readCreatedDelivery(): CreatedDelivery | null {
  if (typeof window === 'undefined') return null

  try {
    const stored = window.sessionStorage.getItem(createdDeliveryStorageKey)
    if (!stored) return null

    const value = JSON.parse(stored) as Partial<CreatedDelivery>
    if (
      typeof value.publicId !== 'string' ||
      typeof value.recipientUrl !== 'string' ||
      typeof value.senderUrl !== 'string' ||
      typeof value.recipientToken !== 'string' ||
      typeof value.senderToken !== 'string'
    ) return null

    return value as CreatedDelivery
  } catch {
    return null
  }
}

const initialForm: CreateDeliveryInput = {
  message: '', sender_name: '', recipient_name: '', origin: '', origin_location: null,
  delivery_mode: 'real', unlock_type: 'none', destination: '', destination_location: null, destination_source: 'specific', arrival_at: toLocalDateTimeInput(new Date(Date.now() + 60 * 60 * 1000)), courier: 'paper-swallow',
  final_duration_minutes: 30, steps: [], route_visibility: 'full',
}

const draftStorageKey = 'cartopia.delivery_draft'

interface DeliveryDraft {
  form: CreateDeliveryInput
  adventureEnabled: boolean
}

function readDeliveryDraft(): DeliveryDraft | null {
  if (typeof window === 'undefined') return null

  try {
    const stored = window.sessionStorage.getItem(draftStorageKey)
    if (!stored) return null

    const value = JSON.parse(stored) as Partial<DeliveryDraft>
    if (!value.form || typeof value.form !== 'object') return null

    const draftForm = value.form
    if (
      typeof draftForm.message !== 'string' ||
      typeof draftForm.recipient_name !== 'string' ||
      typeof draftForm.origin !== 'string' ||
      typeof draftForm.destination !== 'string' ||
      typeof draftForm.final_duration_minutes !== 'number' ||
      typeof draftForm.courier !== 'string' ||
      typeof draftForm.route_visibility !== 'string'
    ) return null

    return {
      form: { ...initialForm, ...draftForm, steps: Array.isArray(draftForm.steps) ? draftForm.steps : [] },
      adventureEnabled: value.adventureEnabled === true,
    }
  } catch {
    return null
  }
}

function hasDeliveryDraft(form: CreateDeliveryInput, adventureEnabled: boolean): boolean {
  return Boolean(
    adventureEnabled ||
    form.message.trim() ||
    form.sender_name?.trim() ||
    form.recipient_name.trim() ||
    form.origin_location ||
    form.destination_location ||
    form.origin.trim() ||
    form.destination.trim() ||
    form.delivery_mode !== 'real' ||
    form.steps?.length,
  )
}

function newStep(): CreateDeliveryStep {
  return { id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `step-${Date.now()}-${Math.random()}`, title: '', description: '', duration_minutes: 30 }
}

export function CreatePage({ onTrack, onHome, onPrivacy, onAccount }: CreatePageProps) {
  const [form, setForm] = useState<CreateDeliveryInput>(() => readDeliveryDraft()?.form ?? initialForm)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})
  const [submitting, setSubmitting] = useState(false)
  const [adventureEnabled, setAdventureEnabled] = useState(() => readDeliveryDraft()?.adventureEnabled ?? false)
  const [showSummary, setShowSummary] = useState(true)
  const [created, setCreated] = useState<CreatedDelivery | null>(readCreatedDelivery)
  const [copied, setCopied] = useState<AccessRole | null>(null)
  const [copyError, setCopyError] = useState<AccessRole | null>(null)
  const [draftRecovered, setDraftRecovered] = useState(() => readDeliveryDraft() !== null)
  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([])
  const [savedRecipients, setSavedRecipients] = useState<SavedRecipient[]>([])
  const [recipientOptions, setRecipientOptions] = useState<RecipientDeliveryOptions | null>(null)
  const [saveNewRecipient, setSaveNewRecipient] = useState(false)
  const [saveNewOrigin, setSaveNewOrigin] = useState(false)
  const [saveNewDestination, setSaveNewDestination] = useState(false)

  useEffect(() => {
    if (!getAuthToken()) return
    void fetchSavedItems().then(({ locations, recipients }) => {
      setSavedLocations(locations)
      setSavedRecipients(recipients)
      const defaultLocation = locations.find((location) => location.is_default)
      if (!draftRecovered && !form.origin_location && defaultLocation) {
        updateEndpoint('origin', defaultLocation)
      }
    }).catch(() => undefined)
  }, [draftRecovered])

  useEffect(() => {
    if (created) {
      window.sessionStorage.setItem(createdDeliveryStorageKey, JSON.stringify(created))
    } else {
      window.sessionStorage.removeItem(createdDeliveryStorageKey)
    }
  }, [created])

  useEffect(() => {
    if (created || !hasDeliveryDraft(form, adventureEnabled)) {
      window.sessionStorage.removeItem(draftStorageKey)
      return
    }

    window.sessionStorage.setItem(draftStorageKey, JSON.stringify({ form, adventureEnabled } satisfies DeliveryDraft))
  }, [created, form, adventureEnabled])

  function updateField(field: keyof CreateDeliveryInput, value: string | number) {
    setForm((current) => ({ ...current, [field]: value }))
    setFieldErrors((current) => ({ ...current, [field]: [] }))
  }

  function clearDraft() {
    window.sessionStorage.removeItem(draftStorageKey)
    setForm(initialForm)
    setAdventureEnabled(false)
    setRecipientOptions(null)
    setFieldErrors({})
    setError('')
    setDraftRecovered(false)
  }

  function updateStep(index: number, field: 'title' | 'description' | 'duration_minutes', value: string | number) {
    setForm((current) => {
      const steps = [...(current.steps ?? [])]
      steps[index] = { ...steps[index], [field]: value }
      return { ...current, steps }
    })
    setFieldErrors((current) => ({ ...current, steps: [] }))
  }

  function updateStepLocation(index: number, location: CreateDeliveryStep['location']) {
    setForm((current) => {
      const steps = [...(current.steps ?? [])]
      steps[index] = { ...steps[index], location }
      return { ...current, steps }
    })
  }

  function updateEndpoint(kind: 'origin' | 'destination', location: { label: string; latitude: number; longitude: number }) {
    setForm((current) => ({ ...current, [kind]: location.label, [`${kind}_location`]: location }))
    setFieldErrors((current) => ({ ...current, [kind]: [], [`${kind}_location`]: [] }))
  }

  function updateDeliveryMode(mode: DeliveryMode) {
    setForm((current) => ({
      ...current,
      delivery_mode: mode,
    }))
    if (mode === 'playful') setRecipientOptions(null)
    setFieldErrors((current) => ({ ...current, origin: [], destination: [], delivery_mode: [] }))
  }

  function updateUnlockType(type: UnlockType) {
    setForm((current) => ({ ...current, unlock_type: type, ...(type === 'none' ? { unlock_password: '' } : {}) }))
    setFieldErrors((current) => ({ ...current, unlock_type: [], unlock_password: [] }))
  }

  function updateDestinationSource(source: DestinationSource) {
    setForm((current) => ({
      ...current,
      destination_source: source,
      ...(source === 'specific' ? {} : { destination: '', destination_location: null }),
    }))
    setFieldErrors((current) => ({ ...current, destination: [], destination_source: [] }))
  }

  async function checkRecipientOptions() {
    const email = form.recipient_email?.trim()
    if (!getAuthToken() || !email) {
      setRecipientOptions(null)
      return
    }
    try {
      setRecipientOptions((await fetchRecipientDeliveryOptions(email)).data)
    } catch {
      setRecipientOptions(null)
    }
  }

  function addStep() {
    setForm((current) => ({ ...current, steps: [...(current.steps ?? []), newStep()] }))
  }

  function toggleAdventure(enabled: boolean) {
    setAdventureEnabled(enabled)
    if (enabled && !(form.steps?.length)) {
      setForm((current) => ({ ...current, steps: [] }))
    }
  }

  function removeStep(index: number) {
    setForm((current) => ({ ...current, steps: (current.steps ?? []).filter((_, stepIndex) => stepIndex !== index) }))
  }

  function moveStep(index: number, direction: -1 | 1) {
    setForm((current) => {
      const steps = [...(current.steps ?? [])]
      const targetIndex = index + direction
      if (targetIndex < 0 || targetIndex >= steps.length) return current
      const [step] = steps.splice(index, 1)
      steps.splice(targetIndex, 0, step)
      return { ...current, steps }
    })
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setFieldErrors({})
    if (form.delivery_mode === 'playful') {
      if (!form.origin.trim() || !form.destination.trim()) { setError('Informe a origem e o destino lúdicos para continuar.'); return }
      if (form.origin.trim() === form.destination.trim()) { setError('Escolha nomes diferentes para a partida e o destino.'); return }
    } else {
      if (!form.origin_location || (form.destination_source === 'specific' && !form.destination_location)) { setError('Escolha a origem e o destino da entrega para continuar.'); return }
      if (form.destination_source === 'specific' && form.origin_location && form.destination_location && form.origin_location.latitude === form.destination_location.latitude && form.origin_location.longitude === form.destination_location.longitude) { setError('Escolha localidades diferentes para a partida e o destino.'); return }
    }
    if (!adventureEnabled) {
      const arrivalAt = new Date(form.arrival_at ?? '')
      if (!form.arrival_at || Number.isNaN(arrivalAt.getTime()) || arrivalAt.getTime() <= Date.now()) {
        setError('Escolha uma data e hora futuras para a chegada da entrega.')
        setFieldErrors({ arrival_at: ['A chegada deve acontecer no futuro.'] })
        return
      }
    }
    if (adventureEnabled && !form.steps?.length) { setError('Adicione pelo menos uma parada para criar uma aventura.'); return }
    setSubmitting(true)
    try {
      const { steps: _steps, legs: _legs, ...directForm } = form
      const input: CreateDeliveryInput = adventureEnabled
        ? {
            ...form,
            steps: form.steps?.map(({ id: _id, location, ...step }) => ({
              ...step,
              ...(form.delivery_mode === 'real' && location ? { location } : {}),
              title: step.title.trim(),
              description: step.description?.trim() || undefined,
              duration_minutes: Number(step.duration_minutes),
            })),
          }
        : directForm
      const response = await createDelivery({
        ...input,
        origin: form.origin.trim(),
        destination: form.destination.trim(),
        ...(form.delivery_mode === 'playful' ? { origin_location: null, destination_location: null, destination_source: 'specific' as const } : {}),
        sender_name: form.sender_name?.trim() || undefined,
        ...(adventureEnabled
          ? {
              duration_minutes: Number(form.duration_minutes),
              final_duration_minutes: Number(form.final_duration_minutes),
            }
          : {
              arrival_at: new Date(form.arrival_at ?? '').toISOString(),
            }),
      })
      if (getAuthToken()) {
        const saveRequests: Promise<unknown>[] = []
        if (saveNewRecipient && form.recipient_name.trim()) {
          saveRequests.push(saveRecipient({ name: form.recipient_name.trim(), email: form.recipient_email?.trim() || undefined }))
        }
        if (saveNewOrigin && form.origin_location) {
          saveRequests.push(saveLocation({ name: form.origin_location.label, label: form.origin_location.label, latitude: form.origin_location.latitude, longitude: form.origin_location.longitude }))
        }
        if (saveNewDestination && form.destination_location) {
          saveRequests.push(saveLocation({ name: form.destination_location.label, label: form.destination_location.label, latitude: form.destination_location.latitude, longitude: form.destination_location.longitude }))
        }
        await Promise.allSettled(saveRequests)
      }
      const recipientToken = response.recipient_access_token ?? response.access_token
      setCreated({ publicId: response.data.public_id, recipientUrl: createShareUrl(window.location.origin, response.data.public_id, recipientToken), senderUrl: createShareUrl(window.location.origin, response.data.public_id, response.sender_access_token, 'sender'), recipientToken, senderToken: response.sender_access_token })
    } catch (caught) {
      if (caught instanceof ApiError) { setError(caught.status === 429 ? 'Muitas tentativas. Aguarde um pouco e tente criar a entrega novamente.' : caught.message); setFieldErrors(caught.fields ?? {}) }
      else setError('Não foi possível criar a entrega. Verifique sua conexão e tente novamente.')
    } finally { setSubmitting(false) }
  }

  async function copyLink(url: string, role: AccessRole) {
    setCopied(null); setCopyError(null)
    if (await copyText(url, navigator.clipboard)) { setCopied(role); window.setTimeout(() => setCopied(null), 2000); return }
    setCopyError(role)
  }

  if (created) {
    return (
      <Shell eyebrow="A aventura está pronta" onHome={onHome} onPrivacy={onPrivacy} onAccount={onAccount}>
        <DeliveryCreationSuccess
          created={created}
          copied={copied}
          copyError={copyError}
          onCopy={copyLink}
          onTrack={onTrack}
          onCreateAnother={() => setCreated(null)}
        />
      </Shell>
    )
  }

  return (
    <Shell onHome={onHome} onPrivacy={onPrivacy} onAccount={onAccount}>
      <section className="intro create-intro">
        {draftRecovered && (
          <div className="draft-restored" role="status">
            <span>Rascunho recuperado desta sessão.</span>
            <button className="text-button" type="button" onClick={clearDraft}>Limpar formulário</button>
          </div>
        )}
        <div className="intro-copy">
          <h1>Toda mensagem tem um destino.<br /><em>Algumas merecem uma aventura.</em></h1>
          <p className="lead">Prepare uma mensagem, escolha o caminho e acompanhe a surpresa até chegar a quem importa.</p>
        </div>
        <div className="hero-route" aria-hidden="true">
          <div className="hero-route-stamp">CP · 01</div>
          <div className="hero-route-map">
            <span className="hero-route-start" />
            <span className="hero-route-path">· · · · · · ·</span>
            <span className="hero-route-end">✦</span>
          </div>
          <div className="hero-route-labels">
            <span>uma lembrança</span>
            <span>alguém especial</span>
          </div>
          <p>toda carta começa<br />com um destino</p>
        </div>
      </section>
      <div className={`create-layout ${showSummary ? '' : 'summary-hidden'}`}>
        <CreateDeliveryForm
          form={form}
          adventureEnabled={adventureEnabled}
          error={error}
          fieldErrors={fieldErrors}
          submitting={submitting}
          onSubmit={submit}
          onFieldChange={updateField}
          onEndpointChange={updateEndpoint}
          onAdventureChange={toggleAdventure}
          onDeliveryModeChange={updateDeliveryMode}
          onUnlockTypeChange={updateUnlockType}
          onStepChange={updateStep}
          onStepLocationChange={updateStepLocation}
          onAddStep={addStep}
          onRemoveStep={removeStep}
          onMoveStep={moveStep}
          savedLocations={savedLocations}
          savedRecipients={savedRecipients}
          recipientOptions={recipientOptions}
          onCheckRecipientOptions={() => void checkRecipientOptions()}
          onDestinationSourceChange={updateDestinationSource}
          canSaveNewItems={Boolean(getAuthToken())}
          saveNewRecipient={saveNewRecipient}
          onSaveNewRecipientChange={setSaveNewRecipient}
          saveNewOrigin={saveNewOrigin}
          onSaveNewOriginChange={setSaveNewOrigin}
          saveNewDestination={saveNewDestination}
          onSaveNewDestinationChange={setSaveNewDestination}
        />
        <aside className={`create-sidebar ${showSummary ? '' : 'collapsed'}`}>
          <button type="button" className="summary-toggle" onClick={() => setShowSummary((visible) => !visible)} aria-expanded={showSummary}>
            {showSummary ? 'Ocultar resumo −' : 'Mostrar resumo +'}
          </button>
          {showSummary && <DeliverySummary form={{ ...form, steps: adventureEnabled ? form.steps : [] }} adventureEnabled={adventureEnabled} />}
        </aside>
      </div>
    </Shell>
  )
}
