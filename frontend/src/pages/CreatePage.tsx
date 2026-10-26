import { useState } from 'react'
import type { FormEvent } from 'react'
import { ApiError, createDelivery } from '../services/api'
import { createShareUrl } from '../services/accessToken'
import { copyText } from '../utils/clipboard'
import { CreateDeliveryForm } from '../components/delivery/CreateDeliveryForm'
import { DeliverySummary } from '../components/delivery/DeliverySummary'
import { DeliveryCreationSuccess } from '../components/delivery/DeliveryCreationSuccess'
import { Shell } from '../components/layout/Shell'
import { locations } from '../domain/delivery/locations'
import type { AccessRole, CreateDeliveryInput, CreateDeliveryStep } from '../domain/delivery/types'

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
  message: '', sender_name: '', recipient_name: '', origin: locations[0].code,
  destination: locations[1].code, duration_minutes: 60, courier: 'paper-swallow',
  final_duration_minutes: 30,
}

export function CreatePage({ onTrack, onHome, onPrivacy }: CreatePageProps) {
  const [form, setForm] = useState<CreateDeliveryInput>(initialForm)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})
  const [submitting, setSubmitting] = useState(false)
  const [adventureEnabled, setAdventureEnabled] = useState(false)
  const [showSummary, setShowSummary] = useState(true)
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

  function addStep() {
    setForm((current) => ({ ...current, steps: [...(current.steps ?? []), { title: '', description: '', duration_minutes: 30 }] }))
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

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setFieldErrors({})
    if (form.origin === form.destination) { setError('Escolha localidades diferentes para a partida e o destino.'); return }
    if (adventureEnabled && !form.steps?.length) { setError('Adicione pelo menos uma parada para criar uma aventura.'); return }
    setSubmitting(true)
    try {
      const response = await createDelivery({ ...form, sender_name: form.sender_name?.trim() || undefined, duration_minutes: Number(form.duration_minutes), final_duration_minutes: Number(form.final_duration_minutes), steps: adventureEnabled ? form.steps?.map((step) => ({ ...step, title: step.title.trim(), description: step.description?.trim() || undefined, duration_minutes: Number(step.duration_minutes) })) : undefined })
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

  if (created) return <Shell eyebrow="A aventura está pronta" onHome={onHome} onPrivacy={onPrivacy}>
    <DeliveryCreationSuccess created={created} copied={copied} copyError={copyError} onCopy={copyLink} onTrack={onTrack} onCreateAnother={() => setCreated(null)} />
  </Shell>

  return <Shell onHome={onHome} onPrivacy={onPrivacy}>
    <section className="intro create-intro"><div className="intro-copy"><h1>Envie uma surpresa<br /><em>pelo caminho.</em></h1><p className="lead">Escreva uma mensagem, trace uma rota e deixe a Cartopia transformar carinho em aventura.</p></div><div className="hero-route" aria-hidden="true"><div className="hero-route-stamp">CP · 01</div><div className="hero-route-map"><span className="hero-route-start" /><span className="hero-route-path">· · · · · · ·</span><span className="hero-route-end">✦</span></div><div className="hero-route-labels"><span>uma lembrança</span><span>alguém especial</span></div><p>toda carta começa<br />com um destino</p></div><div className="create-steps"><span><b>01</b> escreva</span><span><b>02</b> escolha a rota</span><span><b>03</b> acompanhe</span></div></section>
  <div className={`create-layout ${showSummary ? '' : 'summary-hidden'}`}><CreateDeliveryForm form={form} adventureEnabled={adventureEnabled} error={error} fieldErrors={fieldErrors} submitting={submitting} onSubmit={submit} onFieldChange={updateField} onAdventureChange={toggleAdventure} onStepChange={updateStep} onStepLocationChange={updateStepLocation} onAddStep={addStep} onRemoveStep={removeStep} /><aside className={`create-sidebar ${showSummary ? '' : 'collapsed'}`}><button type="button" className="summary-toggle" onClick={() => setShowSummary((visible) => !visible)} aria-expanded={showSummary}>{showSummary ? 'Ocultar resumo −' : 'Mostrar resumo +'}</button>{showSummary && <DeliverySummary form={form} />}</aside></div>
  </Shell>
}
