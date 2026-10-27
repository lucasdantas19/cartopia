import { useState } from 'react'
import type { FormEvent } from 'react'
import { ApiError, createDelivery } from '../services/api'
import { createShareUrl } from '../services/accessToken'
import { copyText } from '../utils/clipboard'
import { CreateDeliveryForm } from '../components/delivery/CreateDeliveryForm'
import { DeliverySummary } from '../components/delivery/DeliverySummary'
import { DeliveryCreationSuccess } from '../components/delivery/DeliveryCreationSuccess'
import { Shell } from '../components/layout/Shell'
import type { AccessRole, CreateDeliveryInput, CreateDeliveryStep } from '../domain/delivery/types'
import { firstUseGuideStorageKey, shouldShowFirstUseGuide } from '../utils/firstUseGuide'

interface CreatePageProps {
  onTrack: (publicId: string, token: string) => void
  onHome: () => void
  onPrivacy: () => void
}

interface CreatedDelivery {
  publicId: string
  recipientUrl: string
  senderUrl: string
  recipientToken: string
}

const initialForm: CreateDeliveryInput = {
  message: '', sender_name: '', recipient_name: '', origin: '', origin_location: null,
  destination: '', destination_location: null, duration_minutes: 60, courier: 'paper-swallow',
  final_duration_minutes: 30, steps: [], route_visibility: 'full',
}

function newStep(): CreateDeliveryStep {
  return { id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `step-${Date.now()}-${Math.random()}`, title: '', description: '', duration_minutes: 30 }
}

export function CreatePage({ onTrack, onHome, onPrivacy }: CreatePageProps) {
  const [form, setForm] = useState<CreateDeliveryInput>(initialForm)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})
  const [submitting, setSubmitting] = useState(false)
  const [adventureEnabled, setAdventureEnabled] = useState(false)
  const [showSummary, setShowSummary] = useState(true)
  const [showFirstUseGuide, setShowFirstUseGuide] = useState(() => shouldShowFirstUseGuide(window.localStorage.getItem(firstUseGuideStorageKey)))
  const [created, setCreated] = useState<CreatedDelivery | null>(null)
  const [copied, setCopied] = useState<AccessRole | null>(null)
  const [copyError, setCopyError] = useState<AccessRole | null>(null)

  function updateField(field: keyof CreateDeliveryInput, value: string | number) {
    setForm((current) => ({ ...current, [field]: value }))
    setFieldErrors((current) => ({ ...current, [field]: [] }))
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

  function addStep() {
    setForm((current) => ({ ...current, steps: [...(current.steps ?? []), newStep()] }))
  }

  function toggleAdventure(enabled: boolean) {
    setAdventureEnabled(enabled)
    if (enabled && !(form.steps?.length)) {
      setForm((current) => ({ ...current, steps: [] }))
    }
  }

  function dismissFirstUseGuide() {
    window.localStorage.setItem(firstUseGuideStorageKey, 'true')
    setShowFirstUseGuide(false)
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
    if (!form.origin_location || !form.destination_location) { setError('Escolha a origem e o destino da entrega para continuar.'); return }
    if (form.origin_location.latitude === form.destination_location.latitude && form.origin_location.longitude === form.destination_location.longitude) { setError('Escolha localidades diferentes para a partida e o destino.'); return }
    if (adventureEnabled && !form.steps?.length) { setError('Adicione pelo menos uma parada para criar uma aventura.'); return }
    setSubmitting(true)
    try {
      const response = await createDelivery({ ...form, sender_name: form.sender_name?.trim() || undefined, duration_minutes: Number(form.duration_minutes), final_duration_minutes: Number(form.final_duration_minutes), steps: adventureEnabled ? form.steps?.map(({ id: _id, ...step }) => ({ ...step, title: step.title.trim(), description: step.description?.trim() || undefined, duration_minutes: Number(step.duration_minutes) })) : undefined })
      const recipientToken = response.recipient_access_token ?? response.access_token
      setCreated({ publicId: response.data.public_id, recipientUrl: createShareUrl(window.location.origin, response.data.public_id, recipientToken), senderUrl: createShareUrl(window.location.origin, response.data.public_id, response.sender_access_token, 'sender'), recipientToken })
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
      <Shell eyebrow="A aventura está pronta" onHome={onHome} onPrivacy={onPrivacy}>
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
    <Shell onHome={onHome} onPrivacy={onPrivacy}>
      <section className="intro create-intro">
        <div className="intro-copy">
          <h1>Envie uma surpresa<br /><em>pelo caminho.</em></h1>
          <p className="lead">Escreva uma mensagem, trace uma rota e deixe a Cartopia transformar carinho em aventura.</p>
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
        <div className="create-steps" aria-label="Como funciona">
          <strong>Como funciona</strong>
          <span><b>01</b><small>Escreva sua mensagem</small></span>
          <span><b>02</b><small>Escolha o tipo de rota</small></span>
          <span><b>03</b><small>Acompanhe a entrega</small></span>
        </div>
      </section>
      {showFirstUseGuide && (
        <aside className="first-use-guide" aria-labelledby="first-use-guide-title">
          <div>
            <span className="eyebrow">Primeira vez por aqui?</span>
            <h2 id="first-use-guide-title">Você cria a viagem em três passos.</h2>
            <div className="first-use-guide-steps">
              <p><strong>1. Escreva</strong><span>Conte a história que será entregue.</span></p>
              <p><strong>2. Escolha</strong><span>Envie direto ou adicione paradas à aventura.</span></p>
              <p><strong>3. Acompanhe</strong><span>Compartilhe o link e veja a jornada acontecer.</span></p>
            </div>
          </div>
          <button type="button" className="text-button first-use-guide-dismiss" onClick={dismissFirstUseGuide}>
            Entendi, começar ✦
          </button>
        </aside>
      )}
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
          onStepChange={updateStep}
          onStepLocationChange={updateStepLocation}
          onAddStep={addStep}
          onRemoveStep={removeStep}
          onMoveStep={moveStep}
        />
        <aside className={`create-sidebar ${showSummary ? '' : 'collapsed'}`}>
          <button type="button" className="summary-toggle" onClick={() => setShowSummary((visible) => !visible)} aria-expanded={showSummary}>
            {showSummary ? 'Ocultar resumo −' : 'Mostrar resumo +'}
          </button>
          {showSummary && <DeliverySummary form={form} />}
        </aside>
      </div>
    </Shell>
  )
}
