import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { ApiError, deleteLocation, deleteRecipient, deleteTrackedDelivery, fetchAccount, fetchIncomingDeliveryToken, fetchTrackedDeliveryToken, getAuthToken, logout, saveLocation, saveRecipient, saveTrackedDelivery, setAuthToken, type AccountDelivery, type AuthUser, type IncomingDelivery, type SavedLocation, type SavedRecipient, type TrackedDelivery } from '../services/api'
import { Shell } from '../components/layout/Shell'
import { LocationPicker } from '../components/delivery/LocationPicker'
import { parseDeliveryLink } from '../services/accessToken'

interface AccountPageProps { onHome: () => void; onPrivacy: () => void; onLogout: () => void; onTrack: (publicId: string, token: string, role: 'sender' | 'recipient') => void }

const statusLabels: Record<string, string> = {
  SCHEDULED: 'Agendada',
  IN_TRANSIT: 'Em trânsito',
  DELIVERED: 'Entregue',
}

function statusLabel(status: string): string {
  return statusLabels[status] ?? status
}

export function AccountPage({ onHome, onPrivacy, onLogout, onTrack }: AccountPageProps) {
  const [account, setAccount] = useState<{ user: AuthUser; deliveries: AccountDelivery[]; locations: SavedLocation[]; recipients: SavedRecipient[]; trackedDeliveries: TrackedDelivery[]; incomingDeliveries: IncomingDelivery[] } | null>(null)
  const [error, setError] = useState('')
  const [trackedLink, setTrackedLink] = useState('')
  const [trackedLabel, setTrackedLabel] = useState('')
  const [savingTracked, setSavingTracked] = useState(false)
  const [location, setLocation] = useState({ name: '', label: '', latitude: '', longitude: '' })
  const [recipient, setRecipient] = useState({ name: '', email: '', nickname: '' })

  async function refresh() {
    try { const data = await fetchAccount(); setAccount({ user: data, deliveries: data.deliveries, locations: data.locations, recipients: data.recipients, trackedDeliveries: data.trackedDeliveries, incomingDeliveries: data.incomingDeliveries }) }
    catch (caught) { setError(caught instanceof ApiError ? caught.message : 'Não foi possível carregar sua conta.') }
  }
  useEffect(() => { void refresh() }, [])

  async function signOut() { await logout().catch(() => undefined); setAuthToken(null); onLogout() }
  async function addLocation(event: FormEvent) {
    event.preventDefault()
    if (location.latitude === '' || location.longitude === '') {
      setError('Escolha um ponto no mapa antes de salvar o lugar.')
      return
    }

    await saveLocation({
      ...location,
      latitude: Number(location.latitude),
      longitude: Number(location.longitude),
    })
    setLocation({ name: '', label: '', latitude: '', longitude: '' })
    await refresh()
  }

  function updateLocationFromMap(value: { label: string; latitude?: number; longitude?: number }) {
    setLocation((current) => ({
      ...current,
      label: value.label,
      latitude: value.latitude === undefined ? current.latitude : String(value.latitude),
      longitude: value.longitude === undefined ? current.longitude : String(value.longitude),
    }))
    setError('')
  }
  async function addRecipient(event: FormEvent) { event.preventDefault(); await saveRecipient({ ...recipient, email: recipient.email || undefined }); setRecipient({ name: '', email: '', nickname: '' }); await refresh() }

  async function addTrackedDelivery(event: FormEvent) {
    event.preventDefault()
    const parsed = parseDeliveryLink(trackedLink)
    if (!parsed) {
      setError('Cole um link completo de entrega, incluindo o token de acesso.')
      return
    }

    setSavingTracked(true)
    setError('')
    try {
      await saveTrackedDelivery({
        public_id: parsed.publicId,
        access_token: parsed.token,
        role: parsed.role,
        label: trackedLabel.trim() || undefined,
      })
      setTrackedLink('')
      setTrackedLabel('')
      await refresh()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Não foi possível salvar essa entrega.')
    } finally {
      setSavingTracked(false)
    }
  }

  async function openTrackedDelivery(item: TrackedDelivery) {
    try {
      const response = await fetchTrackedDeliveryToken(item.id)
      onTrack(response.data.public_id, response.data.access_token, response.data.role)
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Não foi possível abrir essa entrega.')
    }
  }

  const mapLocation = location.label && location.latitude !== '' && location.longitude !== ''
    ? { label: location.label, latitude: Number(location.latitude), longitude: Number(location.longitude) }
    : undefined

  if (!getAuthToken()) return null
  const deliveryCount = account?.deliveries.length ?? 0
  const locationCount = account?.locations.length ?? 0
  const recipientCount = account?.recipients.length ?? 0
  const trackedCount = account?.trackedDeliveries.length ?? 0
  const incomingCount = account?.incomingDeliveries.length ?? 0
  const firstName = account?.user.name.split(' ')[0] ?? 'por aqui'

  return <Shell eyebrow="Seu atlas de lembranças" onHome={onHome} onPrivacy={onPrivacy}>
    <section className="account-hero">
      <div className="account-avatar" aria-hidden="true">{firstName.charAt(0).toUpperCase()}</div>
      <div className="account-hero-copy">
        <p className="eyebrow">Painel da sua conta</p>
        <h1>Olá, {firstName}.</h1>
        <p className="lead">Suas viagens, lugares e pessoas especiais ficam reunidos aqui.</p>
        <span className="account-email">{account?.user.email ?? 'Carregando conta…'}</span>
      </div>
      <button className="button secondary account-logout" type="button" onClick={() => { void signOut() }}>Sair da conta</button>
    </section>
    {error && <p className="error-message" role="alert">{error}</p>}
    <section className="account-overview" aria-label="Resumo da conta">
      <article className="account-stat account-stat-highlight">
        <span className="account-stat-icon" aria-hidden="true">↗</span>
        <div><strong>{deliveryCount}</strong><small>envios realizados</small></div>
      </article>
      <article className="account-stat">
        <span className="account-stat-icon" aria-hidden="true">⌖</span>
        <div><strong>{locationCount}</strong><small>lugares salvos</small></div>
      </article>
      <article className="account-stat">
        <span className="account-stat-icon" aria-hidden="true">♡</span>
        <div><strong>{recipientCount}</strong><small>destinatários</small></div>
      </article>
      <article className="account-stat">
        <span className="account-stat-icon" aria-hidden="true">◷</span>
        <div><strong>{trackedCount}</strong><small>entregas acompanhadas</small></div>
      </article>
      <article className="account-stat account-stat-highlight">
        <span className="account-stat-icon" aria-hidden="true">✉</span>
        <div><strong>{incomingCount}</strong><small>novas para acompanhar</small></div>
      </article>
    </section>
    {incomingCount > 0 && <section className="account-section incoming-section">
      <div className="account-section-heading"><div><p className="account-section-kicker">Chegou para você</p><h2>Novas entregas</h2></div><span>{incomingCount}</span></div>
      <p className="account-section-description">Mensagens enviadas para o seu e-mail aparecem aqui automaticamente.</p>
      <div className="incoming-delivery-list">{account?.incomingDeliveries.map((item) => (
        <article className="incoming-delivery-card" key={item.public_id}>
          <span className={`delivery-status ${item.status.toLowerCase()}`}>{statusLabel(item.status)}</span>
          <div><h3>{item.sender_name ? `${item.sender_name} enviou uma mensagem` : 'Você recebeu uma nova mensagem'}</h3><p>{item.origin} <i aria-hidden="true">→</i> {item.destination}</p></div>
          <button className="button primary" type="button" onClick={() => { void fetchIncomingDeliveryToken(item.public_id).then((response) => onTrack(response.data.public_id, response.data.access_token, 'recipient')).catch((caught) => setError(caught instanceof ApiError ? caught.message : 'Não foi possível abrir essa entrega.')) }}>Acompanhar</button>
        </article>
      ))}</div>
    </section>}
    <section className="account-section tracked-section">
      <div className="account-section-heading">
        <div><p className="account-section-kicker">Sempre por perto</p><h2>Entregas acompanhadas</h2></div>
        <span>{trackedCount}</span>
      </div>
      <p className="account-section-description">Salve um link recebido para acompanhar a viagem direto da sua conta.</p>
      <form className="tracked-delivery-form" onSubmit={addTrackedDelivery}>
        <div className="tracked-delivery-fields">
          <label htmlFor="tracked-delivery-link">Link da entrega</label>
          <input id="tracked-delivery-link" type="url" required value={trackedLink} onChange={(event) => setTrackedLink(event.target.value)} placeholder="https://cartopia.../d/...#token=..." />
          <label htmlFor="tracked-delivery-label">Nome para lembrar <small>(opcional)</small></label>
          <input id="tracked-delivery-label" value={trackedLabel} onChange={(event) => setTrackedLabel(event.target.value)} placeholder="Ex.: Carta da Ana" />
        </div>
        <button className="button secondary" type="submit" disabled={savingTracked}>{savingTracked ? 'Salvando…' : 'Salvar entrega'}</button>
      </form>
      {trackedCount > 0 && <div className="tracked-delivery-list">{account?.trackedDeliveries.map((item) => (
        <article className="tracked-delivery-card" key={item.id}>
          <div className="tracked-delivery-card-main"><span className={`delivery-status ${item.status.toLowerCase()}`}>{statusLabel(item.status)}</span><h3>{item.label || `Entrega para ${item.recipient_name}`}</h3><p>{item.origin} <i aria-hidden="true">→</i> {item.destination}</p><small>Acesso como {item.role === 'sender' ? 'remetente' : 'destinatário'} · {item.progress}% concluído</small></div>
          <div className="tracked-delivery-card-actions"><button className="button secondary" type="button" onClick={() => { void openTrackedDelivery(item) }}>Acompanhar</button><button className="text-button danger" type="button" onClick={() => { void deleteTrackedDelivery(item.id).then(refresh) }}>Remover</button></div>
        </article>
      ))}</div>}
    </section>
    <section className="account-section account-history">
      <div className="account-section-heading">
        <div><p className="account-section-kicker">Suas viagens</p><h2>Histórico de envios</h2></div>
        <span>{deliveryCount} {deliveryCount === 1 ? 'envio' : 'envios'}</span>
      </div>
      {deliveryCount ? account?.deliveries.map((delivery) => (
        <article className="delivery-history-card" key={delivery.public_id}>
          <div className="delivery-history-topline">
            <span className={`delivery-status ${delivery.status.toLowerCase()}`}>{statusLabel(delivery.status)}</span>
            <small>{delivery.progress}% concluído</small>
          </div>
          <h3>Uma mensagem para {delivery.recipient_name}</h3>
          <p className="delivery-history-route"><span>{delivery.origin}</span><i aria-hidden="true">→</i><span>{delivery.destination}</span></p>
          <div className="delivery-progress" aria-label={`${delivery.progress}% da entrega concluída`}><span style={{ width: `${delivery.progress}%` }} /></div>
          <div className="delivery-history-footer"><small>Chegada prevista</small><strong>{new Date(delivery.arrives_at).toLocaleDateString('pt-BR')}</strong></div>
        </article>
      )) : <div className="account-empty-state"><span aria-hidden="true">✦</span><p>Suas próximas aventuras aparecerão aqui.</p><small>Crie uma entrega e acompanhe cada passo da viagem.</small></div>}
    </section>
    <div className="account-columns">
      <section className="account-section">
        <div className="account-section-heading"><div><p className="account-section-kicker">Pontos de partida</p><h2>Lugares salvos</h2></div><span>{locationCount}</span></div>
        {account?.locations.map((item) => (
          <article className="saved-item" key={item.id}>
            <span className="saved-item-icon" aria-hidden="true">⌖</span>
            <div><strong>{item.name}</strong><span>{item.label}</span></div>
            <button className="text-button danger" type="button" onClick={() => { void deleteLocation(item.id).then(refresh) }}>Apagar</button>
          </article>
        ))}
        <form className="account-form compact" onSubmit={addLocation}>
          <label htmlFor="saved-location-name">Nome do lugar</label>
          <input id="saved-location-name" required placeholder="Ex.: Casa da vó" value={location.name} onChange={(event) => setLocation({ ...location, name: event.target.value })} />
          <div className="saved-location-map">
            <LocationPicker
              center={location.longitude !== '' && location.latitude !== '' ? [Number(location.longitude), Number(location.latitude)] : [0, 0]}
              location={mapLocation}
              onChange={updateLocationFromMap}
              onClear={() => setLocation({ ...location, label: '', latitude: '', longitude: '' })}
              clearLabel="escolher outro ponto"
            />
          </div>
          <button className="button secondary" type="submit">Salvar lugar</button>
        </form>
      </section>
      <section className="account-section">
        <div className="account-section-heading"><div><p className="account-section-kicker">Pessoas especiais</p><h2>Destinatários salvos</h2></div><span>{recipientCount}</span></div>
        {account?.recipients.map((item) => (
          <article className="saved-item" key={item.id}>
            <span className="saved-item-icon" aria-hidden="true">♡</span>
            <div><strong>{item.name}</strong><span>{item.nickname || 'Sem apelido'}</span></div>
            <button className="text-button danger" type="button" onClick={() => { void deleteRecipient(item.id).then(refresh) }}>Apagar</button>
          </article>
        ))}
        <form className="account-form compact" onSubmit={addRecipient}>
          <input required placeholder="Nome do destinatário" value={recipient.name} onChange={(event) => setRecipient({ ...recipient, name: event.target.value })} />
          <input type="email" placeholder="E-mail para reconhecer a pessoa" value={recipient.email} onChange={(event) => setRecipient({ ...recipient, email: event.target.value })} />
          <input placeholder="Apelido (opcional)" value={recipient.nickname} onChange={(event) => setRecipient({ ...recipient, nickname: event.target.value })} />
          <button className="button secondary" type="submit">Salvar destinatário</button>
        </form>
      </section>
    </div>
  </Shell>
}
