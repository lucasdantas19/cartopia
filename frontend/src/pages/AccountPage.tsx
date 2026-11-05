import { accountSections, type AccountSection } from '../utils/accountNavigation'
import { Fragment, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { ApiError, clearDefaultLocation, deleteDeliveryPreference, deleteLocation, deleteRecipient, deleteTrackedDelivery, fetchAccount, fetchActiveMapDeliveries, fetchAllSavedLocations, fetchIncomingDeliveryToken, fetchRecipientDeliveries, fetchSentDeliveryToken, fetchTrackedDeliveryToken, getAuthToken, logout, openDeliveryMessage, saveDeliveryPreference, saveLocation, saveRecipient, saveTrackedDelivery, setAuthToken, setDefaultLocation, updateDeliverySettings, updateLocation, updateRecipient, type AccountDelivery, type AccountListKey, type AccountPages, type ActiveMapDelivery, type AuthUser, type DeliveryPreference, type DeliverySettings, type IncomingDelivery, type PaginationMeta, type SavedLocation, type SavedRecipient, type TrackedDelivery } from '../services/api'
import { Shell } from '../components/layout/Shell'
import { LocationPicker } from '../components/delivery/LocationPicker'
import { parseDeliveryLink } from '../services/accessToken'
import { ActiveDeliveriesMap } from '../components/account/ActiveDeliveriesMap'
import { activeMapColors, activeMapRoute } from '../components/account/activeMapRoutes'
import { filterSavedRecipients } from '../utils/recipientDeliveries'

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

function AgendaIcon({ kind }: { kind: 'letter' | 'place' | 'person' }) {
  if (kind === 'place') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M12 21s7-6.2 7-12A7 7 0 0 0 5 9c0 5.8 7 12 7 12Z" />
        <circle cx="12" cy="9" r="2.25" />
      </svg>
    )
  }

  if (kind === 'person') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <circle cx="12" cy="8" r="3.25" />
        <path d="M5.5 20c.55-3.25 2.7-5 6.5-5s5.95 1.75 6.5 5" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M4 6.5h16v11H4z" />
      <path d="m4.5 7 7.5 6 7.5-6" />
    </svg>
  )
}

function AgendaActionIcon({ kind }: { kind: 'edit' | 'default' | 'remove' | 'letters' }) {
  if (kind === 'edit') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="m4 16.5-.7 3.7 3.7-.7L18.8 7.7a2.1 2.1 0 0 0-3-3L4 16.5Z" />
        <path d="m14.5 6.5 3 3" />
      </svg>
    )
  }

  if (kind === 'default') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M12 21s6-5.5 6-11A6 6 0 0 0 6 10c0 5.5 6 11 6 11Z" />
        <circle cx="12" cy="10" r="2" />
      </svg>
    )
  }

  if (kind === 'letters') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M4 7.5h13v10H4z" />
        <path d="m4.5 8 6 4.8L16.5 8" />
        <path d="M8 5h12v10" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M5 7h14M9 7V5h6v2M7 7l.8 12h8.4L17 7M10 10v6M14 10v6" />
    </svg>
  )
}

const recipientAvatarColors = ['#7668b5', '#39727b', '#b26a00', '#b55369', '#4f7894']

function recipientInitial(name: string): string {
  return name.trim().charAt(0).toLocaleUpperCase() || '?'
}

function agendaAvatarColor(id: number): string {
  return recipientAvatarColors[Math.abs(id) % recipientAvatarColors.length]
}

const accountPageSize = 5

interface AccountPaginationProps {
  page: number
  total: number
  onPageChange: (page: number) => void
  label: string
}

function AccountPagination({ page, total, onPageChange, label }: AccountPaginationProps) {
  const lastPage = Math.ceil(total / accountPageSize)
  if (lastPage <= 1) return null

  return (
    <nav className="account-pagination" aria-label={`Paginação de ${label}`}>
      <button
        className="button secondary"
        type="button"
        disabled={page === 1}
        onClick={() => onPageChange(page - 1)}>
        ← Anterior
      </button>
      <span>Página {page} de {lastPage}</span>
      <button
        className="button secondary"
        type="button"
        disabled={page === lastPage}
        onClick={() => onPageChange(page + 1)}>
        Próxima →
      </button>
    </nav>
  )
}

export function AccountPage({ section, onNavigate, onHome, onPrivacy, onLogout, onTrack }: AccountPageProps) {
  const [account, setAccount] = useState<{ user: AuthUser; deliveries: AccountDelivery[]; locations: SavedLocation[]; recipients: SavedRecipient[]; trackedDeliveries: TrackedDelivery[]; incomingDeliveries: IncomingDelivery[]; deliverySettings: DeliverySettings; deliveryPreferences: DeliveryPreference[]; pagination: Record<AccountListKey, PaginationMeta> } | null>(null)
  const letterRef = useRef<HTMLDialogElement>(null)
  const confirmationRef = useRef<HTMLDialogElement>(null)
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
  const [profileLocations, setProfileLocations] = useState<SavedLocation[]>([])
  const [recipient, setRecipient] = useState({ name: '', email: '', nickname: '' })
  const [recipientSearch, setRecipientSearch] = useState('')
  const [editingLocation, setEditingLocation] = useState<SavedLocation | null>(null)
  const [editingRecipient, setEditingRecipient] = useState<SavedRecipient | null>(null)
  const [preference, setPreference] = useState({ senderEmail: '', locationId: '' })
  const [selectedRecipient, setSelectedRecipient] = useState<SavedRecipient | null>(null)
  const [selectedRecipientDeliveries, setSelectedRecipientDeliveries] = useState<AccountDelivery[]>([])
  const [selectedRecipientPagination, setSelectedRecipientPagination] = useState<PaginationMeta | null>(null)
  const [selectedRecipientLoading, setSelectedRecipientLoading] = useState(false)
  const [selectedRecipientPage, setSelectedRecipientPage] = useState(1)
  const [listPages, setListPages] = useState<AccountPages>({})
  const [letterModal, setLetterModal] = useState<{ sender: string | null; message: string } | null>(null)
  const [letterLoading, setLetterLoading] = useState(false)
  const [notice, setNotice] = useState('')
  const [confirmation, setConfirmation] = useState<{ message: string; onConfirm: () => void } | null>(null)
  useEffect(() => {
    if (!letterModal) return
    const previousFocus = document.activeElement as HTMLElement | null
    letterRef.current?.showModal()
    return () => { if (previousFocus?.isConnected) previousFocus.focus() }
  }, [letterModal])
  useEffect(() => {
    if (!confirmation) return
    const previousFocus = document.activeElement as HTMLElement | null
    confirmationRef.current?.showModal()
    return () => { if (previousFocus?.isConnected) previousFocus.focus() }
  }, [confirmation])
  async function refresh(pages: AccountPages = listPages, search = recipientSearch) {
    setError('')
    try {
      const data = await fetchAccount(pages, search)
      setAccount({
        user: data,
        deliveries: data.deliveries,
        locations: data.locations,
        recipients: data.recipients,
        trackedDeliveries: data.trackedDeliveries,
        incomingDeliveries: data.incomingDeliveries,
        deliverySettings: data.deliverySettings,
        deliveryPreferences: data.deliveryPreferences,
        pagination: data.pagination,
      })
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Não foi possível carregar sua conta.')
    }
  }
  useEffect(() => { void refresh() }, [])
  useEffect(() => {
    if (section !== 'profile') return
    void fetchAllSavedLocations().then((locations) => setProfileLocations(locations)).catch(() => undefined)
  }, [section])
  useEffect(() => {
    headingRef.current?.focus()
    window.scrollTo({ top: 0 })
  }, [section])
  async function loadRecipientDeliveries(item: SavedRecipient, page = 1) {
    setSelectedRecipientLoading(true)
    try {
      const response = await fetchRecipientDeliveries(item, page)
      setSelectedRecipientDeliveries(response.data)
      setSelectedRecipientPagination(response.meta)
      setSelectedRecipientPage(page)
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Não foi possível carregar as cartas desta pessoa.')
    } finally {
      setSelectedRecipientLoading(false)
    }
  }

  async function selectRecipient(item: SavedRecipient) {
    if (selectedRecipient?.id === item.id) {
      setSelectedRecipient(null)
      setSelectedRecipientDeliveries([])
      setSelectedRecipientPagination(null)
      return
    }

    setSelectedRecipient(item)
    setSelectedRecipientDeliveries([])
    setSelectedRecipientPagination(null)
    setSelectedRecipientPage(1)
    await loadRecipientDeliveries(item)
  }

  function requestDestructiveAction(message: string, onConfirm: () => void) {
    setConfirmation({ message, onConfirm })
  }

  async function mutate(action: () => Promise<unknown>, successMessage?: string) {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await action()
      await refresh()
      if (section === 'profile') {
        setProfileLocations(await fetchAllSavedLocations())
      }
      if (selectedRecipient) await loadRecipientDeliveries(selectedRecipient, selectedRecipientPage)
      if (successMessage) setNotice(successMessage)
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
  async function submitLocationEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editingLocation) return
    await mutate(async () => {
      await updateLocation(editingLocation.id, {
        name: editingLocation.name,
        label: editingLocation.label,
        latitude: editingLocation.latitude,
        longitude: editingLocation.longitude,
      })
      setEditingLocation(null)
    }, 'Lugar atualizado.')
  }

  async function submitRecipientEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editingRecipient) return
    await mutate(async () => {
      await updateRecipient(editingRecipient.id, {
        name: editingRecipient.name,
        email: editingRecipient.email || undefined,
        nickname: editingRecipient.nickname || undefined,
      })
      setEditingRecipient(null)
    }, 'Destinatário atualizado.')
  }

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
        is_default: locationCount === 0,
      })
      setLocation({ name: '', label: '', latitude: '', longitude: '' })
    }, 'Lugar salvo.')
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
    }, 'Destinatário salvo.')
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
  async function addDeliveryPreference(event: FormEvent) {
    event.preventDefault()
    await mutate(async () => {
      await saveDeliveryPreference({ sender_email: preference.senderEmail.trim(), location_id: Number(preference.locationId) })
      setPreference({ senderEmail: '', locationId: '' })
    }, 'Preferência salva.')
  }
  async function openTrackedDelivery(item: TrackedDelivery) {
    try {
      const response = await fetchTrackedDeliveryToken(item.id)
      onTrack(response.data.public_id, response.data.access_token, response.data.role)
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Não foi possível abrir essa entrega.')
    }
  }

  async function openSentDelivery(item: AccountDelivery) {
    try {
      const response = await fetchSentDeliveryToken(item.public_id)
      onTrack(response.data.public_id, response.data.access_token, 'sender')
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
  const deliveryCount = account?.pagination.deliveries.total ?? 0
  const locationCount = account?.pagination.locations.total ?? 0
  const recipientCount = account?.pagination.recipients.total ?? 0
  const trackedCount = account?.pagination.trackedDeliveries.total ?? 0
  const unopenedCount = account?.pagination.unopenedDeliveries.total ?? 0
  const openedCount = account?.pagination.openedLetters.total ?? 0
  const incomingCount = unopenedCount + openedCount
  const openedLetters = account?.incomingDeliveries.filter((item) => item.opened_at !== null) ?? []
  const unopenedDeliveries = account?.incomingDeliveries.filter((item) => item.opened_at === null) ?? []
  const firstName = account?.user.name.split(' ')[0] ?? 'por aqui'
  const currentSection = accountSections.find((item) => item.id === section)!
  const readyLetters = unopenedDeliveries.filter((item) => item.status === 'DELIVERED')
  const visibleRecipients = filterSavedRecipients(account?.recipients ?? [], recipientSearch)
  const recipientsWithEmail = account?.recipients.filter((item) => item.email) ?? []
  function changeListPage(key: AccountListKey, page: number) {
    const nextPages = { ...listPages, [key]: page }
    setListPages(nextPages)
    void refresh(nextPages, recipientSearch)
  }

  function searchRecipients(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextPages = { ...listPages, recipients: 1 }
    setListPages(nextPages)
    void refresh(nextPages, recipientSearch)
  }
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
          {notice && <p className="success-message" role="status">{notice}</p>}
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
              <div className="account-preference-setting account-default-location-setting">
                <h2>Endereço de partida padrão</h2>
                <p>Este é o endereço usado como ponto de partida quando você escolher reutilizar um lugar salvo em uma nova carta.</p>
                {profileLocations.length === 0 ? (
                  <p className="muted-copy">Salve um lugar na Agenda para definir um endereço de partida.</p>
                ) : (
                  <label htmlFor="profile-default-location">
                    Escolha o endereço de partida
                    <select
                      id="profile-default-location"
                      value={String(profileLocations.find((item) => item.is_default)?.id ?? '')}
                      onChange={(event) => {
                        const locationId = Number(event.target.value)
                        if (!locationId) return
                        void mutate(() => setDefaultLocation(locationId), 'Endereço de partida padrão atualizado.')
                      }}>
                      <option value="">Nenhum endereço padrão</option>
                      {profileLocations.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} · {item.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
              <div className="account-preference-setting">
                <h2>Receber entregas de contatos</h2>
                <p>Quando ativado, pessoas com uma conta poderão enviar cartas para seu endereço padrão ou para uma preferência específica.</p>
                <label className="save-new-option">
                  <input
                    type="checkbox"
                    checked={account.deliverySettings.allow_contact_delivery}
                    onChange={(event) => {
                      void mutate(async () => {
                        const response = await updateDeliverySettings(event.target.checked)
                        setAccount((current) => current ? { ...current, deliverySettings: response.data } : current)
                      })
                    }} />
                  <span>Permitir entregas de contatos</span>
                </label>
              </div>
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
                  <article className="incoming-delivery-card incoming-delivery-card-new" key={item.public_id}>
                    <span className={`delivery-status ${item.status.toLowerCase()}`}>{statusLabel(item.status)}</span>
                    <div className="incoming-delivery-card-main">
                      <h3>{item.sender_name ? `${item.sender_name} enviou uma mensagem` : 'Você recebeu uma nova mensagem'}</h3>
                      <p className="incoming-delivery-route">
                        {item.origin}
                        <i aria-hidden="true">→</i>
                        {item.destination}
                      </p>
                      <small className="incoming-delivery-arrival">
                        Chegada prevista para {new Date(item.arrives_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                      </small>
                    </div>
                    <div className="incoming-delivery-card-actions">
                      <button
                        className="button primary"
                        type="button"
                        disabled={letterLoading}
                        onClick={() => { void openIncomingDelivery(item, item.status === 'DELIVERED') }}>
                        {item.status === 'DELIVERED' ? 'Abrir carta' : 'Acompanhar viagem'}
                      </button>
                    </div>
                  </article>
                ))}
                </div>
              <AccountPagination page={account?.pagination.unopenedDeliveries.current_page ?? 1} total={unopenedCount} onPageChange={(page) => changeListPage('unopenedDeliveries', page)} label="novas mensagens" />
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
                    <article className="incoming-delivery-card incoming-delivery-card-opened" key={item.public_id}>
                      <span className="delivery-status delivered">Carta aberta</span>
                      <div className="incoming-delivery-card-main">
                        <h3>{item.sender_name ? `Carta de ${item.sender_name}` : 'Uma carta para você'}</h3>
                        <p className="incoming-delivery-route">
                          {item.origin}
                          <i aria-hidden="true">→</i>
                          {item.destination}
                        </p>
                        <small className="incoming-delivery-arrival">Aberta em {new Date(item.opened_at!).toLocaleDateString('pt-BR')}</small>
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
              <AccountPagination page={account?.pagination.openedLetters.current_page ?? 1} total={openedCount} onPageChange={(page) => changeListPage('openedLetters', page)} label="cartas abertas" />
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
          {confirmation && (
            <dialog
              ref={confirmationRef}
              className="account-confirmation-dialog"
              aria-labelledby="account-confirmation-title"
              onCancel={() => setConfirmation(null)}
              onClose={() => setConfirmation(null)}>
              <p className="account-section-kicker">Confirme a ação</p>
              <h2 id="account-confirmation-title">Tem certeza?</h2>
              <p>{confirmation.message}</p>
              <div className="account-confirmation-actions">
                <button className="button secondary" type="button" onClick={() => setConfirmation(null)}>
                  Cancelar
                </button>
                <button
                  className="button danger-button"
                  type="button"
                  onClick={() => {
                    const action = confirmation.onConfirm
                    setConfirmation(null)
                    action()
                  }}>
                  Apagar
                </button>
              </div>
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
              <AccountPagination page={account?.pagination.trackedDeliveries.current_page ?? 1} total={trackedCount} onPageChange={(page) => changeListPage('trackedDeliveries', page)} label="entregas acompanhadas" />
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
                  <button
                    className="button secondary"
                    type="button"
                    onClick={() => { void openSentDelivery(delivery) }}>
                    Entrar na entrega
                  </button>
                </article>
              )) : <div className="account-empty-state">
                <span aria-hidden="true">✦</span>
                <p>Suas próximas aventuras aparecerão aqui.</p>
                <small>Crie uma entrega e acompanhe cada passo da viagem.</small>
              </div>}
              <AccountPagination page={account?.pagination.deliveries.current_page ?? 1} total={deliveryCount} onPageChange={(page) => changeListPage('deliveries', page)} label="envios" />
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
                  <Fragment key={item.id}>
                  <article className={`saved-item ${item.is_default ? 'saved-item-default' : ''}`}>
                      <span
                        className="saved-item-icon saved-item-avatar saved-item-avatar-place"
                        aria-hidden="true"
                        style={{
                          backgroundColor: agendaAvatarColor(item.id),
                          color: '#fff',
                        }}>
                        {recipientInitial(item.name)}
                      </span>
                    <div>
                      <strong>{item.name}</strong>
                      <span>{item.label}</span>
                      {item.is_default && <small className="saved-item-badge">Endereço de partida padrão</small>}
                    </div>
                    <div className="saved-item-actions">
                      <button
                        className="icon-button"
                        type="button"
                        aria-label={`Editar ${item.name}`}
                        title="Editar lugar"
                        onClick={() => setEditingLocation(item)}>
                        <AgendaActionIcon kind="edit" />
                      </button>
                      <button
                        className="icon-button"
                        type="button"
                        aria-label={item.is_default ? `Remover ${item.name} como partida padrão` : `Definir ${item.name} como partida padrão`}
                        title={item.is_default ? 'Remover como partida padrão' : 'Definir como partida padrão'}
                        onClick={() => {
                          if (item.is_default) {
                            void mutate(() => clearDefaultLocation(item.id), 'Endereço de partida padrão removido.')
                            return
                          }
                          void mutate(() => setDefaultLocation(item.id), 'Endereço de partida padrão atualizado.')
                        }}>
                        <AgendaActionIcon kind="default" />
                      </button>
                      <button
                        className="icon-button danger"
                        type="button"
                        aria-label={`Apagar ${item.name}`}
                        title="Apagar lugar"
                        onClick={() => {
                          requestDestructiveAction(`Apagar o lugar “${item.name}”?`, () => {
                            void mutate(() => deleteLocation(item.id), 'Lugar apagado.')
                          })
                        }}>
                        <AgendaActionIcon kind="remove" />
                      </button>
                    </div>
                  </article>
                  {editingLocation?.id === item.id && (
                    <form className="saved-item-edit-form" onSubmit={submitLocationEdit}>
                      <label>
                        Nome do lugar
                        <input
                          required
                          value={editingLocation.name}
                          onChange={(event) => setEditingLocation({ ...editingLocation, name: event.target.value })} />
                      </label>
                      <label>
                        Endereço ou descrição
                        <input
                          required
                          value={editingLocation.label}
                          onChange={(event) => setEditingLocation({ ...editingLocation, label: event.target.value })} />
                      </label>
                      <div className="saved-location-edit-map">
                        <LocationPicker
                          center={[editingLocation.longitude, editingLocation.latitude]}
                          location={{
                            label: editingLocation.label,
                            latitude: editingLocation.latitude,
                            longitude: editingLocation.longitude,
                          }}
                          onChange={(value) => {
                            if (value.latitude === undefined || value.longitude === undefined) return
                            setEditingLocation({
                              ...editingLocation,
                              label: value.label,
                              latitude: value.latitude,
                              longitude: value.longitude,
                            })
                          }}
                          onClear={() => setEditingLocation({ ...editingLocation, label: '' })}
                          clearLabel="escolher outro ponto" />
                      </div>
                      <div className="saved-item-edit-actions">
                        <button className="button secondary" type="submit" disabled={busy}>Salvar alterações</button>
                        <button className="text-button" type="button" onClick={() => setEditingLocation(null)}>Cancelar</button>
                      </div>
                    </form>
                  )}
                  </Fragment>
                ))}
                <AccountPagination page={account?.pagination.locations.current_page ?? 1} total={locationCount} onPageChange={(page) => changeListPage('locations', page)} label="lugares salvos" />
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
                <details className="account-add-item">
                  <summary>Preferências para contatos</summary>
                  <p className="muted-copy">Escolha qual dos seus lugares cada contato poderá usar ao enviar uma carta.</p>
                  {account.deliveryPreferences.map((item) => (
                    <article className="saved-item" key={item.id}>
                      <span
                        className="saved-item-icon saved-item-avatar saved-item-avatar-preference"
                        aria-hidden="true"
                        style={{
                          backgroundColor: agendaAvatarColor(item.sender.id),
                          color: '#fff',
                        }}>
                        {recipientInitial(item.sender.name)}
                      </span>
                      <div>
                        <strong>{item.sender.name}</strong>
                        <span>{item.location.name}</span>
                      </div>
                      <div className="saved-item-actions">
                        <button
                          className="icon-button danger"
                          type="button"
                          aria-label={`Apagar preferência para ${item.sender.name}`}
                          title="Apagar preferência"
                          onClick={() => {
                            requestDestructiveAction(`Apagar a preferência para ${item.sender.name}?`, () => {
                              void mutate(() => deleteDeliveryPreference(item.id), 'Preferência apagada.')
                            })
                          }}>
                          <AgendaActionIcon kind="remove" />
                        </button>
                      </div>
                    </article>
                  ))}
                  <AccountPagination page={account.pagination.deliveryPreferences.current_page} total={account.pagination.deliveryPreferences.total} onPageChange={(page) => changeListPage('deliveryPreferences', page)} label="preferências para contatos" />
                  <form className="account-form compact" onSubmit={addDeliveryPreference}>
                    <label htmlFor="preference-recipient">Contato autorizado</label>
                    <select
                      id="preference-recipient"
                      required
                      value={preference.senderEmail}
                      onChange={(event) => setPreference({ ...preference, senderEmail: event.target.value })}
                      disabled={recipientsWithEmail.length === 0}>
                      <option value="">Escolha um contato salvo…</option>
                      {recipientsWithEmail.map((item) => (
                        <option key={item.id} value={item.email!}>
                          {item.name} · {item.email}
                        </option>
                      ))}
                    </select>
                    {recipientsWithEmail.length === 0 && (
                      <small className="field-help">Salve um contato com e-mail para criar uma preferência.</small>
                    )}
                    <label htmlFor="preference-location">Lugar permitido</label>
                    <select id="preference-location" required value={preference.locationId} onChange={(event) => setPreference({ ...preference, locationId: event.target.value })}>
                      <option value="">Escolha um lugar salvo…</option>
                      {account.locations.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.label}</option>)}
                    </select>
                    <button className="button secondary" type="submit" disabled={busy || account.locations.length === 0 || recipientsWithEmail.length === 0}>Salvar preferência</button>
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
                {(recipientCount > 0 || recipientSearch) && (
                  <form className="agenda-search" onSubmit={searchRecipients}>
                    <label htmlFor="agenda-recipient-search">Pesquisar pessoa</label>
                    <input
                      id="agenda-recipient-search"
                      type="search"
                      value={recipientSearch}
                      onChange={(event) => setRecipientSearch(event.target.value)}
                      placeholder="Nome, apelido ou e-mail" />
                    <button className="button secondary" type="submit">Pesquisar</button>
                  </form>
                )}
                {(recipientCount > 0 || recipientSearch) && visibleRecipients.length === 0 && (
                  <p className="muted-copy">Nenhuma pessoa encontrada nessa busca.</p>
                )}
                {visibleRecipients.map((item) => (
                  <Fragment key={item.id}>
                  <article className="saved-item">
                    <span
                      className="saved-item-icon saved-item-avatar"
                      aria-hidden="true"
                      style={{
                        backgroundColor: agendaAvatarColor(item.id),
                        color: '#fff',
                      }}>
                      {recipientInitial(item.name)}
                    </span>
                    <div>
                      <strong>{item.name}</strong>
                      <span>{item.nickname || 'Sem apelido'}</span>
                    </div>
                    <div className="saved-item-actions">
                      <button
                        className="icon-button"
                        type="button"
                        aria-label={`Editar ${item.name}`}
                        title="Editar destinatário"
                        onClick={() => setEditingRecipient(item)}>
                        <AgendaActionIcon kind="edit" />
                      </button>
                      <button
                        className="icon-button"
                        type="button"
                        aria-pressed={selectedRecipient?.id === item.id}
                        aria-label={selectedRecipient?.id === item.id ? `Ocultar cartas de ${item.name}` : `Ver cartas de ${item.name}`}
                        title={selectedRecipient?.id === item.id ? 'Ocultar cartas' : 'Ver cartas'}
                        onClick={() => { void selectRecipient(item) }}
                        aria-expanded={selectedRecipient?.id === item.id}>
                        <AgendaActionIcon kind="letters" />
                      </button>
                      <button
                        className="icon-button danger"
                        type="button"
                        aria-label={`Apagar ${item.name}`}
                        title="Apagar destinatário"
                        onClick={() => {
                          requestDestructiveAction(`Apagar ${item.name} da sua agenda?`, () => {
                            if (selectedRecipient?.id === item.id) {
                              setSelectedRecipient(null)
                              setSelectedRecipientDeliveries([])
                              setSelectedRecipientPagination(null)
                            }
                            void mutate(() => deleteRecipient(item.id), 'Destinatário apagado.')
                          })
                        }}>
                        <AgendaActionIcon kind="remove" />
                      </button>
                    </div>
                  </article>
                  {editingRecipient?.id === item.id && (
                    <form className="saved-item-edit-form" onSubmit={submitRecipientEdit}>
                      <label>
                        Nome
                        <input
                          required
                          value={editingRecipient.name}
                          onChange={(event) => setEditingRecipient({ ...editingRecipient, name: event.target.value })} />
                      </label>
                      <label>
                        E-mail
                        <input
                          type="email"
                          value={editingRecipient.email ?? ''}
                          onChange={(event) => setEditingRecipient({ ...editingRecipient, email: event.target.value || null })} />
                      </label>
                      <label>
                        Apelido
                        <input
                          value={editingRecipient.nickname ?? ''}
                          onChange={(event) => setEditingRecipient({ ...editingRecipient, nickname: event.target.value || null })} />
                      </label>
                      <div className="saved-item-edit-actions">
                        <button className="button secondary" type="submit" disabled={busy}>Salvar alterações</button>
                        <button className="text-button" type="button" onClick={() => setEditingRecipient(null)}>Cancelar</button>
                      </div>
                    </form>
                  )}
                  </Fragment>
                ))}
                <AccountPagination page={account?.pagination.recipients.current_page ?? 1} total={recipientCount} onPageChange={(page) => changeListPage('recipients', page)} label="destinatários salvos" />
                <details className="account-add-item">
                  <summary>
                    <AgendaIcon kind="letter" />
                    Salvar pessoa na agenda
                  </summary>
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
              {selectedRecipient && (
                <section className="account-section recipient-deliveries-section" aria-labelledby="recipient-deliveries-title">
                  <div className="account-section-heading">
                    <div>
                      <p className="account-section-kicker">Histórico filtrado</p>
                      <h2 id="recipient-deliveries-title">Cartas para {selectedRecipient.nickname || selectedRecipient.name}</h2>
                    </div>
                    <span>{selectedRecipientPagination?.total ?? 0}</span>
                  </div>
                  {selectedRecipientLoading ? (
                    <p role="status">Carregando cartas…</p>
                  ) : selectedRecipientDeliveries.length === 0 ? (
                    <p className="muted-copy">Nenhuma carta enviada para este destinatário ainda.</p>
                  ) : selectedRecipientDeliveries.map((delivery) => (
                    <article className="delivery-history-card" key={delivery.public_id}>
                      <div className="delivery-history-topline">
                        <span className={'delivery-status ' + delivery.status.toLowerCase()}>{statusLabel(delivery.status)}</span>
                        <small>{delivery.progress}% concluído</small>
                      </div>
                      <h3>{delivery.origin} <span aria-hidden="true">→</span> {delivery.destination}</h3>
                      <div className="delivery-progress" aria-label={delivery.progress + '% da entrega concluída'}>
                        <span style={{ width: delivery.progress + '%' }} />
                      </div>
                      <div className="delivery-history-footer">
                        <small>Chegada prevista</small>
                        <strong>{new Date(delivery.arrives_at).toLocaleDateString('pt-BR')}</strong>
                      </div>
                      <button className="button secondary" type="button" onClick={() => { void openSentDelivery(delivery) }}>Abrir entrega</button>
                    </article>
                  ))}
                  {selectedRecipientPagination && (
                    <AccountPagination
                      page={selectedRecipientPage}
                      total={selectedRecipientPagination.total}
                      onPageChange={(page) => {
                        if (selectedRecipient) void loadRecipientDeliveries(selectedRecipient, page)
                      }}
                      label={`cartas para ${selectedRecipient.name}`} />
                  )}
                </section>
              )}
            </div>
          )}
        </div>
      </div>
    </Shell>
  )
}
