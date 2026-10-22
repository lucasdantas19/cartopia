import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { ApiError, createDelivery, fetchDelivery, openDeliveryMessage } from './api'
import { createShareUrl, removeAccessToken, resolveAccessToken } from './accessToken'
import { formatLocalDate, formatRemaining, progressFromTime, statusFromTime } from './dateTime'
import type { CreateDeliveryInput, Delivery, DeliveryStatus } from './types'
import './App.css'

const locations = [
  { value: 'port-of-dreams', label: 'Porto dos Sonhos' },
  { value: 'garden-of-ideas', label: 'Jardim das Ideias' },
  { value: 'library-of-memories', label: 'Biblioteca das Memórias' },
]

const courierLabels: Record<string, string> = { 'paper-swallow': 'Andorinha de Papel' }
const initialNow = Date.now()
type Route = { page: 'create' } | { page: 'tracking'; publicId: string }

function routeFromLocation(): Route {
  const match = window.location.pathname.match(/^\/d\/([^/]+)$/)
  return match ? { page: 'tracking', publicId: decodeURIComponent(match[1]) } : { page: 'create' }
}

function navigate(path: string) {
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

function locationLabel(value: string) { return locations.find((location) => location.value === value)?.label ?? value }

function statusLabel(status: DeliveryStatus) {
  return { SCHEDULED: 'Preparando a partida', IN_TRANSIT: 'A caminho', DELIVERED: 'Chegou ao destino' }[status]
}

function App() {
  const [route, setRoute] = useState<Route>(routeFromLocation)

  useEffect(() => {
    const onPopState = () => setRoute(routeFromLocation())
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  return route.page === 'tracking'
    ? <TrackingPage key={route.publicId} publicId={route.publicId} onHome={() => navigate('/')} />
    : <CreatePage onTrack={(publicId, token) => navigate(`/d/${publicId}#token=${encodeURIComponent(token)}`)} />
}

function Shell({ children, eyebrow = 'Cartas que atravessam mundos' }: { children: React.ReactNode; eyebrow?: string }) {
  return <div className="app-shell">
    <header className="topbar">
      <button className="brand" type="button" onClick={() => navigate('/')} aria-label="Voltar para o início"><span className="brand-mark">✦</span>Cartopia</button>
      <span className="topbar-note">Cada mensagem, uma aventura.</span>
    </header>
    <main className="page-content"><p className="eyebrow">{eyebrow}</p>{children}</main>
    <footer>Feito para transformar carinho em caminho.</footer>
  </div>
}

function CreatePage({ onTrack }: { onTrack: (publicId: string, token: string) => void }) {
  const [form, setForm] = useState<CreateDeliveryInput>({ message: '', sender_name: '', recipient_name: '', origin: locations[0].value, destination: locations[1].value, duration_minutes: 60 })
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})
  const [submitting, setSubmitting] = useState(false)
  const [created, setCreated] = useState<{ publicId: string; token: string; url: string } | null>(null)
  const [copied, setCopied] = useState(false)

  function updateField(field: keyof CreateDeliveryInput, value: string | number) {
    setForm((current) => ({ ...current, [field]: value }))
    setFieldErrors((current) => ({ ...current, [field]: [] }))
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setFieldErrors({})
    if (form.origin === form.destination) { setError('Escolha localidades diferentes para a partida e o destino.'); return }
    setSubmitting(true)
    try {
      const response = await createDelivery({ ...form, sender_name: form.sender_name?.trim() || undefined, duration_minutes: Number(form.duration_minutes) })
      const url = createShareUrl(window.location.origin, response.data.public_id, response.access_token)
      setCreated({ publicId: response.data.public_id, token: response.access_token, url })
    } catch (caught) {
      if (caught instanceof ApiError) { setError(caught.message); setFieldErrors(caught.fields ?? {}) }
      else setError('Não foi possível criar a entrega. Verifique sua conexão e tente novamente.')
    } finally { setSubmitting(false) }
  }

  async function copyLink() {
    if (!created) return
    await navigator.clipboard.writeText(created.url)
    setCopied(true); window.setTimeout(() => setCopied(false), 2000)
  }

  if (created) return <Shell eyebrow="A aventura está pronta">
    <section className="success-card"><span className="success-icon">✉</span><h1>Uma carta partiu!</h1><p className="lead">Compartilhe este link para que alguém especial acompanhe a viagem.</p>
      <div className="share-box"><span>{created.url}</span><button className="button secondary" type="button" onClick={copyLink}>{copied ? 'Copiado!' : 'Copiar link'}</button></div>
      <div className="success-actions"><button className="button primary" type="button" onClick={() => onTrack(created.publicId, created.token)}>Acompanhar agora</button><button className="text-button" type="button" onClick={() => setCreated(null)}>Criar outra carta</button></div>
    </section>
  </Shell>

  return <Shell>
    <section className="intro"><h1>Envie uma surpresa<br /><em>pelo caminho.</em></h1><p className="lead">Escreva uma mensagem, escolha uma rota e deixe a Cartopia fazer a entrega.</p></section>
    <form className="delivery-form" onSubmit={submit}>
      <div className="form-section"><div className="section-heading"><span>01</span><div><h2>A mensagem</h2><p>O que você quer enviar?</p></div></div>
        <label htmlFor="message">Sua mensagem <span className="required">*</span></label><textarea id="message" required maxLength={10000} value={form.message} onChange={(event) => updateField('message', event.target.value)} placeholder="Era uma vez uma mensagem..." rows={5} />{fieldErrors.message && <FieldError messages={fieldErrors.message} />}
      </div>
      <div className="form-section"><div className="section-heading"><span>02</span><div><h2>Para quem?</h2><p>Conte-nos quem vai receber.</p></div></div>
        <div className="field-grid"><div><label htmlFor="sender_name">Seu nome <small>(opcional)</small></label><input id="sender_name" maxLength={120} value={form.sender_name} onChange={(event) => updateField('sender_name', event.target.value)} placeholder="Como devemos assinar?" />{fieldErrors.sender_name && <FieldError messages={fieldErrors.sender_name} />}</div><div><label htmlFor="recipient_name">Nome do destinatário <span className="required">*</span></label><input id="recipient_name" required maxLength={120} value={form.recipient_name} onChange={(event) => updateField('recipient_name', event.target.value)} placeholder="Quem receberá?" />{fieldErrors.recipient_name && <FieldError messages={fieldErrors.recipient_name} />}</div></div>
      </div>
      <div className="form-section"><div className="section-heading"><span>03</span><div><h2>Trace a rota</h2><p>Escolha onde a jornada começa e termina.</p></div></div>
        <div className="route-fields"><div><label htmlFor="origin">De</label><select id="origin" value={form.origin} onChange={(event) => updateField('origin', event.target.value)}>{locations.map((location) => <option key={location.value} value={location.value}>{location.label}</option>)}</select></div><span className="route-arrow" aria-hidden="true">→</span><div><label htmlFor="destination">Para</label><select id="destination" value={form.destination} onChange={(event) => updateField('destination', event.target.value)}>{locations.map((location) => <option key={location.value} value={location.value}>{location.label}</option>)}</select></div></div>
        {error && <p className="error-message" role="alert">{error}</p>}{fieldErrors.origin && <FieldError messages={fieldErrors.origin} />}{fieldErrors.destination && <FieldError messages={fieldErrors.destination} />}
        <div className="duration-field"><label htmlFor="duration_minutes">Duração da viagem <small>(1 a 1440 minutos)</small></label><div className="duration-input"><input id="duration_minutes" type="number" required min={1} max={1440} value={form.duration_minutes} onChange={(event) => updateField('duration_minutes', Number(event.target.value))} /><span>minutos</span></div>{fieldErrors.duration_minutes && <FieldError messages={fieldErrors.duration_minutes} />}</div>
      </div>
      <button className="button primary submit-button" type="submit" disabled={submitting}>{submitting ? 'Preparando a entrega…' : 'Enviar pela Cartopia ✦'}</button>
    </form>
  </Shell>
}

function FieldError({ messages }: { messages: string[] }) { return <p className="field-error" role="alert">{messages[0]}</p> }

function TrackingPage({ publicId, onHome }: { publicId: string; onHome: () => void }) {
  const [auth, setAuth] = useState<{ ready: boolean; token: string | null }>({ ready: false, token: null })
  const [delivery, setDelivery] = useState<Delivery | null>(null)
  const [error, setError] = useState('')
  const [opening, setOpening] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [messageError, setMessageError] = useState('')
  const [now, setNow] = useState(initialNow)

  useEffect(() => {
    const resolve = window.setTimeout(() => {
      const access = resolveAccessToken(publicId, window.location.hash, window.sessionStorage)

      if (access.fromFragment) {
        window.history.replaceState({}, '', `${window.location.pathname}${window.location.search}`)
      }

      setAuth({ ready: true, token: access.token })
    }, 0)

    return () => window.clearTimeout(resolve)
  }, [publicId])

  useEffect(() => {
    const token = auth.token
    if (!auth.ready || !token) return
    let cancelled = false
    const load = async () => {
      try { const response = await fetchDelivery(publicId, token); if (!cancelled) { setDelivery(response.data); setError('') } }
      catch (caught) {
        if (cancelled) return

        if (caught instanceof ApiError && caught.status === 404) {
          removeAccessToken(publicId, window.sessionStorage)
          setAuth({ ready: true, token: null })
          setError('Este link não é válido ou não temos acesso a esta entrega. Abra novamente o link original.')
          return
        }

        setError('Não foi possível carregar a viagem.')
      }
      finally { /* delivery/error state represents the request lifecycle. */ }
    }
    void load(); const refresh = window.setInterval(load, 30000)
    return () => { cancelled = true; window.clearInterval(refresh) }
  }, [auth, publicId])

  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer) }, [])

  async function revealMessage() {
    if (!delivery || !auth.token) return
    setOpening(true); setMessageError('')
    try { const response = await openDeliveryMessage(publicId, auth.token); setMessage(response.data.message) }
    catch (caught) {
      if (caught instanceof ApiError && caught.status === 404) {
        removeAccessToken(publicId, window.sessionStorage)
        setAuth({ ready: true, token: null })
        setError('Este link não é válido ou não temos acesso a esta entrega. Abra novamente o link original.')
        return
      }

      setMessageError(caught instanceof ApiError && caught.code === 'DELIVERY_NOT_ARRIVED' ? 'A viagem ainda está a caminho. Tente novamente quando ela chegar.' : 'Não foi possível abrir esta mensagem com este link.')
    }
    finally { setOpening(false) }
  }

  const isLoading = !auth.ready || (!!auth.token && !delivery && !error)
  if (isLoading) return <Shell eyebrow="Abrindo seu mapa de viagem"><Loading /></Shell>
  if (!auth.token || error) return <Shell eyebrow="A viagem não foi encontrada"><ErrorState message={error || 'Este link precisa do token original para abrir a entrega.'} onHome={onHome} /></Shell>
  if (!delivery) return null

  const visualStatus = statusFromTime(delivery, now)
  const visualProgress = progressFromTime(delivery, now)
  const canOpen = visualStatus === 'DELIVERED'

  return <Shell eyebrow="Acompanhamento da aventura">
    <section className="tracking-header"><div><p className="tracking-kicker">Uma entrega para</p><h1>{delivery.recipient_name}</h1><p className="lead">{delivery.sender_name ? `${delivery.sender_name} preparou uma surpresa para você.` : 'Alguém preparou uma surpresa para você.'}</p></div><div className={`status-pill ${visualStatus.toLowerCase()}`}><span className="status-dot" />{statusLabel(visualStatus)}</div></section>
    <section className="journey-card"><div className="journey-meta"><span>{locationLabel(delivery.origin)}</span><span>{visualProgress}% da jornada</span><span>{locationLabel(delivery.destination)}</span></div><div className="journey-line" aria-label={`Progresso da viagem: ${visualProgress}%`}><span className="journey-fill" style={{ width: `${visualProgress}%` }} /><span className="courier-icon" style={{ left: `${visualProgress}%` }}>✉</span><span className="journey-node start" /><span className="journey-node end" /></div><div className="journey-footer"><span>✦ {courierLabels[delivery.courier] ?? delivery.courier}</span><strong>{formatRemaining(delivery.arrives_at, now)}</strong></div></section>
    <section className="details-grid"><div><span>Partida</span><strong>{formatLocalDate(delivery.starts_at)}</strong></div><div><span>Chegada prevista</span><strong>{formatLocalDate(delivery.arrives_at)}</strong></div></section>
    <section className={`message-card ${canOpen ? 'unlocked' : ''}`}>{message ? <div className="letter"><p className="letter-label">Uma carta para você</p><p className="letter-message">{message}</p><span className="letter-signature">Com carinho, Cartopia ✦</span></div> : <><span className="lock-icon">{canOpen ? '✉' : '⌛'}</span><h2>{canOpen ? 'A mensagem chegou.' : 'A mensagem está viajando.'}</h2><p>{canOpen ? 'A surpresa está pronta para ser aberta.' : 'Quando a entrega chegar, você poderá abrir a carta.'}</p><button className="button primary" type="button" disabled={!canOpen || opening} onClick={revealMessage}>{opening ? 'Abrindo…' : canOpen ? 'Abrir mensagem' : 'Aguardando chegada'}</button>{messageError && <p className="error-message" role="alert">{messageError}</p>}</>}</section>
  </Shell>
}

function Loading() { return <div className="state-card"><span className="loader" /><h1>Seguindo a trilha…</h1><p className="lead">Estamos procurando sua entrega.</p></div> }
function ErrorState({ message, onHome }: { message: string; onHome: () => void }) { return <div className="state-card"><span className="state-icon">?</span><h1>Ops, não encontramos.</h1><p className="lead">{message}</p><button className="button secondary" type="button" onClick={onHome}>Voltar ao início</button></div> }

export default App
