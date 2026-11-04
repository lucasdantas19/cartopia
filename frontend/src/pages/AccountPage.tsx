import { accountSections, type AccountSection } from '../utils/accountNavigation'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { ApiError, deleteLocation, deleteRecipient, deleteTrackedDelivery, fetchAccount, fetchActiveMapDeliveries, fetchIncomingDeliveryToken, fetchTrackedDeliveryToken, getAuthToken, logout, openDeliveryMessage, saveLocation, saveRecipient, saveTrackedDelivery, setAuthToken, setDefaultLocation, type AccountDelivery, type ActiveMapDelivery, type AuthUser, type IncomingDelivery, type SavedLocation, type SavedRecipient, type TrackedDelivery } from '../services/api'
import { Shell } from '../components/layout/Shell'
import { LocationPicker } from '../components/delivery/LocationPicker'
import { parseDeliveryLink } from '../services/accessToken'
import { ActiveDeliveriesMap } from '../components/account/ActiveDeliveriesMap'
import { activeMapColors, activeMapRoute } from '../components/account/activeMapRoutes'

interface AccountPageProps {
  section: AccountSection
  onNavigate: (path: string) => void
  onHome: () => void
  onPrivacy: () => void
  onLogout: () => void
  onTrack: (publicId: string, token: string, role: 'sender' | 'recipient', openMessage?: boolean) => void
}

const statusLabels: Record<string, string> = {
  SCHEDULED: 'Agendada',
  IN_TRANSIT: 'Em trânsito',
  DELIVERED: 'Entregue',
}

function statusLabel(status: string): string {
  return statusLabels[status] ?? status
}

export function AccountPage({ section, onNavigate, onHome, onPrivacy, onLogout, onTrack }: AccountPageProps) {
  const [account, setAccount] = useState<{ user: AuthUser; deliveries: AccountDelivery[]; locations: SavedLocation[]; recipients: SavedRecipient[]; trackedDeliveries: TrackedDelivery[]; incomingDeliveries: IncomingDelivery[] } | null>(null)
  const letterRef = useRef<HTMLDialogElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [activeDeliveries, setActiveDeliveries] = useState<ActiveMapDelivery[]>([])
  const [activeMapLoading, setActiveMapLoading] = useState(true)
  const [activeMapError, setActiveMapError] = useState('')
  const [selectedMapDeliveryId, setSelectedMapDeliveryId] = useState<string | null>(null)
  const [trackedLink, setTrackedLink] = useState('')
  const [trackedLabel, setTrackedLabel] = useState('')
  const [savingTracked, setSavingTracked] = useState(false)
  const [location, setLocation] = useState({ name: '', label: '', latitude: '', longitude: '' })
  const [recipient, setRecipient] = useState({ name: '', email: '', nickname: '' })
  const [letterModal, setLetterModal] = useState<{ sender: string | null; message: string } | null>(null)
  const [letterLoading, setLetterLoading] = useState(false)
  useEffect(() => {
    if (!letterModal) return
    const previousFocus = document.activeElement as HTMLElement | null
    letterRef.current?.showModal()
    return () => { if (previousFocus?.isConnected) previousFocus.focus() }
  }, [letterModal])
  async function refresh() {
    setError('')
    try {
      const data = await fetchAccount()
      setAccount({
        user: data,
        deliveries: data.deliveries,
        locations: data.locations,
        recipients: data.recipients,
        trackedDeliveries: data.trackedDeliveries,
        incomingDeliveries: data.incomingDeliveries,
      })
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Não foi possível carregar sua conta.')
    }
  }
  useEffect(() => { void refresh() }, [])
  useEffect(() => {
    headingRef.current?.focus()
    window.scrollTo({ top: 0 })
  }, [section])
  async function mutate(action: () => Promise<unknown>) {
    setBusy(true)
    setError('')
    try {
      await action()
      await refresh()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Não foi possível concluir a ação. Tente novamente.')
    } finally {
      setBusy(false)
    }
  }
  useEffect(() => {
    if (section !== 'sent') return
    let active = true
    async function refreshActiveMap() {
      try {
        const response = await fetchActiveMapDeliveries()
        if (active) {
          setActiveDeliveries(response.data)
          setActiveMapError('')
        }
      } catch (caught) {
        if (active) setActiveMapError(caught instanceof ApiError ? caught.message : 'Não foi possível carregar o mapa.')
      } finally {
        if (active) setActiveMapLoading(false)
      }
    }
    void refreshActiveMap()
    const interval = window.setInterval(() => void refreshActiveMap(), 30_000)
    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [section])
  async function signOut() { await logout().catch(() => undefined); setAuthToken(null); onLogout() }
  async function addLocation(event: FormEvent) {
    event.preventDefault()
    if (location.latitude === '' || location.longitude === '') {
      setError('Escolha um ponto no mapa antes de salvar o lugar.')
      return
    }
    await mutate(async () => {
      await saveLocation({
        ...location,
        latitude: Number(location.latitude),
        longitude: Number(location.longitude),
        is_default: account?.locations.length === 0,
      })
      setLocation({ name: '', label: '', latitude: '', longitude: '' })
    })
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
  async function addRecipient(event: FormEvent) {
    event.preventDefault()
    await mutate(async () => {
      await saveRecipient({ ...recipient, email: recipient.email || undefined })
      setRecipient({ name: '', email: '', nickname: '' })
    })
  }

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
  async function openIncomingDelivery(item: IncomingDelivery, openMessage = false) {
    setLetterLoading(true)
    try {
      const response = await fetchIncomingDeliveryToken(item.public_id)
      if (openMessage) {
        setLetterLoading(true)
        const message = await openDeliveryMessage(item.public_id, response.data.access_token)
        setLetterModal({ sender: item.sender_name, message: message.data.message })
        await refresh()
        return
      }
      onTrack(response.data.public_id, response.data.access_token, 'recipient')
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Não foi possível abrir essa entrega.')
    } finally {
      setLetterLoading(false)
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
  const openedLetters = account?.incomingDeliveries.filter((item) => item.opened_at !== null) ?? []
  const unopenedDeliveries = account?.incomingDeliveries.filter((item) => item.opened_at === null) ?? []
  const firstName = account?.user.name.split(' ')[0] ?? 'por aqui'
  const currentSection = accountSections.find((item) => item.id === section)!
  const readyLetters = unopenedDeliveries.filter((item) => item.status === 'DELIVERED')
  return (
    <Shell
      eyebrow="Meu correio"
      onHome={onHome}
      onPrivacy={onPrivacy}>
      <div className="account-workspace">
        <aside className="account-navigation">
          <p className="account-nav-label">Minha conta</p>
          <nav aria-label="Navegação da conta">
            {accountSections.map((item) => (
              <a
                key={item.id}
                href={item.path}
                aria-current={section === item.id ? 'page' : undefined}
                onClick={(event) => {
                  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
                  event.preventDefault()
                  onNavigate(item.path)
                }}
              >
                {item.label}
                {item.id === 'letters' && readyLetters.length > 0 && <span>{readyLetters.length}</span>}
              </a>
            ))}
          </nav>
          <button
            className="button primary"
            type="button"
            onClick={onHome}>Escrever uma carta</button>
        </aside>
        <div className="account-content" aria-busy={busy}>
          <header className="account-page-heading">
            <p className="eyebrow">{section === 'overview' ? `Olá, ${firstName}` : 'Meu correio'}</p>
            <h1 ref={headingRef} tabIndex={-1}>{currentSection.label}</h1>
            <p>{currentSection.description}</p>
          </header>
          {error && <p className="error-message" role="alert">{error}</p>}
          {!account && (
            <div className="account-empty-state">
              {error ? (
                <button
                  className="button secondary"
                  type="button"
                  onClick={() => void refresh()}>Tentar novamente</button>
              ) : <p role="status">Carregando seu correio…</p>}
            </div>
          )}
          {account && section === 'overview' && (
            <section className="account-dashboard" aria-label="Resumo do seu correio">
              <div className="account-welcome">
                <span className="account-welcome-mark" aria-hidden="true">✉</span>
                <div>
                  <h2>{readyLetters.length ? 'Há carinho esperando por você.' : 'Toda lembrança começa com uma carta.'}</h2>
                  <p>{readyLetters.length ? `${readyLetters.length} ${readyLetters.length === 1 ? 'mensagem pronta' : 'mensagens prontas'} para abrir na sua caixa de cartas.` : 'Escreva para alguém especial ou acompanhe as histórias que já estão a caminho.'}</p>
                  <button
                    className="button primary"
                    type="button"
                    onClick={() => readyLetters.length ? onNavigate('/conta/cartas') : onHome()}>
                    {readyLetters.length ? 'Abrir caixa de cartas' : 'Escrever uma carta'}
                  </button>
                </div>
              </div>
              <div className="account-quick-links">
                {[
                  { label: 'Cartas recebidas', count: incomingCount, path: '/conta/cartas', hint: 'Novas mensagens e cartas abertas' },
                  { label: 'Meus envios', count: deliveryCount, path: '/conta/envios', hint: 'Viagens no mapa e histórico' },
                  { label: 'Acompanhamentos', count: trackedCount, path: '/conta/acompanhamentos', hint: 'Entregas que você salvou' },
                ].map((item) => (
                  <button
                    key={item.path}
                    type="button"
                    onClick={() => onNavigate(item.path)}>
                    <strong>{item.count}</strong>
                    <span>{item.label} →</span>
                    <small>{item.hint}</small>
                  </button>
                ))}
              </div>
              <div className="account-agenda-shortcut">
                <div>
                  <h2>Sua agenda</h2>
                  <p>{recipientCount} {recipientCount === 1 ? 'pessoa' : 'pessoas'} e {locationCount} {locationCount === 1 ? 'lugar salvo' : 'lugares salvos'} para facilitar o próximo envio.</p>
                </div>
                <button
                  className="button secondary"
                  type="button"
                  onClick={() => onNavigate('/conta/agenda')}>Organizar agenda</button>
              </div>
            </section>
          )}
          {account && section === 'profile' && (
            <section className="account-profile">
              <h2>Dados da conta</h2>
              <dl>
                <dt>Nome</dt>
                <dd>{account.user.name}</dd>
                <dt>E-mail</dt>
                <dd>{account.user.email}</dd>
              </dl>
              <p>Mensagens enviadas para este e-mail aparecem na sua caixa de cartas.</p>
              <button
                className="button secondary"
                type="button"
                onClick={() => void signOut()}>Sair da conta</button>
            </section>
          )}
          {account && section === 'sent' && (
            <section className="account-section active-deliveries-section" aria-labelledby="active-deliveries-title">
              <div className="account-section-heading">
                <div>
                  <p className="account-section-kicker">A caminho</p>
                  <h2 id="active-deliveries-title">Viagens no mapa</h2>
                </div>
                <span>{activeDeliveries.length} de até 5</span>
              </div>
              <p className="account-section-description">
                Suas entregas mais recentes em andamento, com posições estimadas pelo tempo da viagem.
              </p>
              {activeMapLoading ? (
                <p role="status">Carregando viagens…</p>
              ) : activeMapError ? (
                <p className="error-message" role="alert">{activeMapError}</p>
              ) : activeDeliveries.length === 0 ? (
                <p>Nenhuma entrega em andamento agora.</p>
              ) : (
                <>
                  {activeDeliveries.some((delivery) => activeMapRoute(delivery)) ? (
                    <ActiveDeliveriesMap
                      deliveries={activeDeliveries}
                      selectedId={selectedMapDeliveryId}
                      onSelect={setSelectedMapDeliveryId}
                    />
                  ) : (
                    <p>Estas entregas não têm coordenadas para aparecer no mapa.</p>
                  )}
                  <ul className="active-deliveries-legend">
                    {activeDeliveries.map((delivery, index) => (
                      <li key={delivery.public_id}>
                        <button
                          type="button"
                          className="active-deliveries-legend-button"
                          aria-pressed={selectedMapDeliveryId === delivery.public_id}
                          disabled={!activeMapRoute(delivery)}
                          onClick={() => setSelectedMapDeliveryId(delivery.public_id)}
                        >
                          <span
                            className="active-deliveries-swatch"
                            style={{ backgroundColor: activeMapColors[index] }}
                            aria-hidden="true" />
                          <span>
                            <strong>Para {delivery.recipient_name}</strong>
                            <small>{delivery.origin} → {delivery.destination}</small>
                            {!activeMapRoute(delivery) && <small>Sem coordenadas para o mapa</small>}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          )}
          {account && section === 'letters' && unopenedDeliveries.length > 0 && (
            <section className="account-section incoming-section" aria-labelledby="new-deliveries-title">
              <div className="account-section-heading">
                <div>
                  <p className="account-section-kicker">Chegou para você</p>
                  <h2 id="new-deliveries-title">Novas mensagens</h2>
                </div>
                <span>{unopenedDeliveries.length}</span>
              </div>
              <p className="account-section-description">Mensagens enviadas para o seu e-mail aparecem aqui automaticamente.</p>
              <div className="incoming-delivery-list">
                {unopenedDeliveries.map((item) => (
                  <article className="incoming-delivery-card" key={item.public_id}>
                    <span className={`delivery-status ${item.status.toLowerCase()}`}>{statusLabel(item.status)}</span>
                    <div>
                      <h3>{item.sender_name ? `${item.sender_name} enviou uma mensagem` : 'Você recebeu uma nova mensagem'}</h3>
                      <p>
                        {item.origin}
                        <i aria-hidden="true">→</i>
                        {item.destination}
                      </p>
                    </div>
                    <button
                      className="button primary"
                      type="button"
                      disabled={letterLoading}
                      onClick={() => { void openIncomingDelivery(item, item.status === 'DELIVERED') }}>
                      {item.status === 'DELIVERED' ? 'Abrir carta' : 'Acompanhar viagem'}
                    </button>
                  </article>
                ))}
              </div>
            </section>
          )}
          {account && section === 'letters' && (
            <section className="account-section incoming-section" aria-labelledby="received-messages-title">
              <div className="account-section-heading">
                <div>
                  <p className="account-section-kicker">Sua caixa de cartas</p>
                  <h2 id="received-messages-title">Cartas abertas</h2>
                </div>
                <span>{openedLetters.length} {openedLetters.length === 1 ? 'carta aberta' : 'cartas abertas'}</span>
              </div>
              <p className="account-section-description">Releia suas cartas abertas e veja os detalhes de cada entrega.</p>
              {openedLetters.length === 0 ? (
                <p>Nenhuma carta aberta ainda. Quando você abrir uma mensagem, ela aparecerá aqui.</p>
              ) : (
                <div className="incoming-delivery-list">
                  {openedLetters.map((item) => (
                    <article className="incoming-delivery-card" key={item.public_id}>
                      <span className="delivery-status delivered">Carta aberta</span>
                      <div>
                        <h3>{item.sender_name ? `Carta de ${item.sender_name}` : 'Uma carta para você'}</h3>
                        <p>
                          {item.origin}
                          <i aria-hidden="true">→</i>
                          {item.destination}
                        </p>
                        <small>Aberta em {new Date(item.opened_at!).toLocaleDateString('pt-BR')}</small>
                      </div>
                      <div className="incoming-delivery-card-actions">
                        <button
                          className="button secondary"
                          type="button"
                          onClick={() => { void openIncomingDelivery(item) }}>Ver entrega</button>
                        <button
                          className="button primary"
                          type="button"
                          disabled={letterLoading}
                          onClick={() => { void openIncomingDelivery(item, true) }}>{letterLoading ? 'Abrindo…' : 'Ver carta'}</button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}
          {letterModal && (
            <dialog
              ref={letterRef}
              className="letter-modal"
              aria-labelledby="letter-modal-title"
              onCancel={() => setLetterModal(null)}
              onClose={() => setLetterModal(null)}
            >
              <button
                className="letter-modal-close"
                type="button"
                aria-label="Fechar carta"
                onClick={() => setLetterModal(null)}>×</button>
              <div className="letter-modal-seal" aria-hidden="true">✦</div>
              <p className="letter-modal-kicker">Uma mensagem para você</p>
              <h2 id="letter-modal-title">{letterModal.sender ? `Carta de ${letterModal.sender}` : 'Uma carta para você'}</h2>
              <div className="letter-modal-rule" aria-hidden="true" />
              <p className="letter-modal-message">{letterModal.message}</p>
              <p className="letter-modal-signature">
                Com carinho, Cartopia
                <span aria-hidden="true">✦</span>
              </p>
            </dialog>
          )}
          {account && section === 'tracked' && (
            <section className="account-section tracked-section">
              <div className="account-section-heading">
                <div>
                  <p className="account-section-kicker">Sempre por perto</p>
                  <h2>Entregas acompanhadas</h2>
                </div>
                <span>{trackedCount}</span>
              </div>
              <p className="account-section-description">Salve um link recebido para acompanhar a viagem direto da sua conta.</p>
              <form className="tracked-delivery-form" onSubmit={addTrackedDelivery}>
                <div className="tracked-delivery-fields">
                  <label htmlFor="tracked-delivery-link">Link da entrega</label>
                  <input
                    id="tracked-delivery-link"
                    type="url"
                    required
                    value={trackedLink}
                    onChange={(event) => setTrackedLink(event.target.value)}
                    placeholder="https://cartopia.../d/...#token=..." />
                  <label htmlFor="tracked-delivery-label">
                    Nome para lembrar
                    <small>(opcional)</small>
                  </label>
                  <input
                    id="tracked-delivery-label"
                    value={trackedLabel}
                    onChange={(event) => setTrackedLabel(event.target.value)}
                    placeholder="Ex.: Carta da Ana" />
                </div>
                <button
                  className="button secondary"
                  type="submit"
                  disabled={savingTracked}>{savingTracked ? 'Salvando…' : 'Salvar entrega'}</button>
              </form>
              {trackedCount > 0 && <div className="tracked-delivery-list">{account?.trackedDeliveries.map((item) => (
                <article className="tracked-delivery-card" key={item.id}>
                  <div className="tracked-delivery-card-main">
                    <span className={`delivery-status ${item.status.toLowerCase()}`}>{statusLabel(item.status)}</span>
                    <h3>{item.label || `Entrega para ${item.recipient_name}`}</h3>
                    <p>
                      {item.origin}
                      <i aria-hidden="true">→</i>
                      {item.destination}
                    </p>
                    <small>Acesso como {item.role === 'sender' ? 'remetente' : 'destinatário'} · {item.progress}% concluído</small>
                  </div>
                  <div className="tracked-delivery-card-actions">
                    <button
                      className="button secondary"
                      type="button"
                      onClick={() => { void openTrackedDelivery(item) }}>Acompanhar</button>
                    <button
                      className="text-button danger"
                      type="button"
                      onClick={() => { void mutate(() => deleteTrackedDelivery(item.id)) }}>Remover</button>
                  </div>
                </article>
              ))}</div>}
            </section>
          )}
          {account && section === 'sent' && (
            <section className="account-section account-history">
              <div className="account-section-heading">
                <div>
                  <p className="account-section-kicker">Suas viagens</p>
                  <h2>Histórico de envios</h2>
                </div>
                <span>{deliveryCount} {deliveryCount === 1 ? 'envio' : 'envios'}</span>
              </div>
              {deliveryCount ? account?.deliveries.map((delivery) => (
                <article className="delivery-history-card" key={delivery.public_id}>
                  <div className="delivery-history-topline">
                    <span className={`delivery-status ${delivery.status.toLowerCase()}`}>{statusLabel(delivery.status)}</span>
                    <small>{delivery.progress}% concluído</small>
                  </div>
                  <h3>Uma mensagem para {delivery.recipient_name}</h3>
                  <p className="delivery-history-route">
                    <span>{delivery.origin}</span>
                    <i aria-hidden="true">→</i>
                    <span>{delivery.destination}</span>
                  </p>
                  <div className="delivery-progress" aria-label={`${delivery.progress}% da entrega concluída`}>
                    <span style={{ width: `${delivery.progress}%` }} />
                  </div>
                  <div className="delivery-history-footer">
                    <small>Chegada prevista</small>
                    <strong>{new Date(delivery.arrives_at).toLocaleDateString('pt-BR')}</strong>
                  </div>
                </article>
              )) : <div className="account-empty-state">
                <span aria-hidden="true">✦</span>
                <p>Suas próximas aventuras aparecerão aqui.</p>
                <small>Crie uma entrega e acompanhe cada passo da viagem.</small>
              </div>}
            </section>
          )}
          {account && section === 'addressBook' && (
            <div className="account-columns">
              <section className="account-section">
                <div className="account-section-heading">
                  <div>
                    <p className="account-section-kicker">Pontos de partida</p>
                    <h2>Lugares salvos</h2>
                  </div>
                  <span>{locationCount}</span>
                </div>
                {locationCount === 0 && <p className="muted-copy">Salve um lugar para reutilizar nas próximas cartas.</p>}
                {account?.locations.map((item) => (
                  <article className={`saved-item ${item.is_default ? 'saved-item-default' : ''}`} key={item.id}>
                    <span className="saved-item-icon" aria-hidden="true">⌖</span>
                    <div>
                      <strong>{item.name}</strong>
                      <span>{item.label}</span>
                      {item.is_default && <small className="saved-item-badge">Partida padrão</small>}
                    </div>
                    <div className="saved-item-actions">
                      {!item.is_default && <button
                        className="text-button"
                        type="button"
                        onClick={() => { void mutate(() => setDefaultLocation(item.id)) }}>Usar como padrão</button>}
                      <button
                        className="text-button danger"
                        type="button"
                        onClick={() => { void mutate(() => deleteLocation(item.id)) }}>Apagar</button>
                    </div>
                  </article>
                ))}
                <details className="account-add-item">
                  <summary>Adicionar lugar</summary>
                  <form className="account-form compact" onSubmit={addLocation}>
                    <label htmlFor="saved-location-name">Nome do lugar</label>
                    <input
                      id="saved-location-name"
                      required
                      placeholder="Ex.: Casa da vó"
                      value={location.name}
                      onChange={(event) => setLocation({ ...location, name: event.target.value })} />
                    <div className="saved-location-map">
                      <LocationPicker
                        center={location.longitude !== '' && location.latitude !== '' ? [Number(location.longitude), Number(location.latitude)] : [0, 0]}
                        location={mapLocation}
                        onChange={updateLocationFromMap}
                        onClear={() => setLocation({ ...location, label: '', latitude: '', longitude: '' })}
                        clearLabel="escolher outro ponto"
                      />
                    </div>
                    <button
                      className="button secondary"
                      type="submit"
                      disabled={busy}>Salvar lugar</button>
                  </form>
                </details>
              </section>
              <section className="account-section">
                <div className="account-section-heading">
                  <div>
                    <p className="account-section-kicker">Pessoas especiais</p>
                    <h2>Destinatários salvos</h2>
                  </div>
                  <span>{recipientCount}</span>
                </div>
                {recipientCount === 0 && <p className="muted-copy">Adicione alguém especial à sua agenda.</p>}
                {account?.recipients.map((item) => (
                  <article className="saved-item" key={item.id}>
                    <span className="saved-item-icon" aria-hidden="true">♡</span>
                    <div>
                      <strong>{item.name}</strong>
                      <span>{item.nickname || 'Sem apelido'}</span>
                    </div>
                    <button
                      className="text-button danger"
                      type="button"
                      onClick={() => { void mutate(() => deleteRecipient(item.id)) }}>Apagar</button>
                  </article>
                ))}
                <details className="account-add-item">
                  <summary>Adicionar pessoa</summary>
                  <form className="account-form compact" onSubmit={addRecipient}>
                    <label htmlFor="saved-person-name">Nome</label>
                    <input
                      id="saved-person-name"
                      required
                      placeholder="Nome do destinatário"
                      value={recipient.name}
                      onChange={(event) => setRecipient({ ...recipient, name: event.target.value })} />
                    <label htmlFor="saved-person-email">E-mail (opcional)</label>
                    <input
                      id="saved-person-email"
                      type="email"
                      placeholder="E-mail para reconhecer a pessoa"
                      value={recipient.email}
                      onChange={(event) => setRecipient({ ...recipient, email: event.target.value })} />
                    <label htmlFor="saved-person-nickname">Apelido (opcional)</label>
                    <input
                      id="saved-person-nickname"
                      placeholder="Apelido (opcional)"
                      value={recipient.nickname}
                      onChange={(event) => setRecipient({ ...recipient, nickname: event.target.value })} />
                    <button
                      className="button secondary"
                      type="submit"
                      disabled={busy}>Salvar destinatário</button>
                  </form>
                </details>
              </section>
            </div>
          )}
        </div>
      </div>
    </Shell>
  )
}
