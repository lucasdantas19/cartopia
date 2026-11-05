import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import {
  ApiError,
  deleteAdminDelivery,
  fetchAdminDeliveries,
  regenerateAdminLinks,
} from '../services/api'
import type { AdminDeliverySummary, DeliveryStatus } from '../domain/delivery/types'
import { AdminUsersPanel } from '../components/admin/AdminUsersPanel'

const adminTokenKey = 'cartopia:admin-token'
const statusLabels: Record<DeliveryStatus, string> = {
  SCHEDULED: 'Agendada',
  IN_TRANSIT: 'Em trânsito',
  DELIVERED: 'Entregue',
}

interface AdminPageProps {
  onHome: () => void
}

interface GeneratedLinks {
  recipient_path: string
  sender_path: string
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function AdminPage({ onHome }: AdminPageProps) {
  const [token, setToken] = useState(() => window.sessionStorage.getItem(adminTokenKey) ?? '')
  const [tokenInput, setTokenInput] = useState('')
  const [deliveries, setDeliveries] = useState<AdminDeliverySummary[]>([])
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [deliveryScope, setDeliveryScope] = useState<'all' | 'anonymous' | 'account'>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [pageMeta, setPageMeta] = useState({
    total: 0,
    per_page: 20,
    current_page: 1,
    last_page: 1,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')
  const [links, setLinks] = useState<GeneratedLinks | null>(null)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [copiedLink, setCopiedLink] = useState<string | null>(null)
  const loadedToken = useRef<string | null>(null)
  const [view, setView] = useState<'deliveries' | 'users'>('deliveries')

  const load = useCallback(async (
    currentToken: string,
    currentPage: number,
    currentQuery: string,
    currentStatus: string,
    currentOwner: string,
    currentDateFrom: string,
    currentDateTo: string,
  ) => {
    if (!currentToken) return

    setLoading(true)
    setError('')
    setFeedback('')

    try {
      const response = await fetchAdminDeliveries(
        currentToken,
        currentQuery,
        currentStatus,
        currentPage,
        currentOwner,
        currentDateFrom,
        currentDateTo,
      )

      setDeliveries(response.data)
      setPageMeta(response.meta)
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        window.sessionStorage.removeItem(adminTokenKey)
        loadedToken.current = null
        setToken('')
        setError('Token administrativo inválido ou expirado.')
      } else {
        setError('Não foi possível carregar as entregas.')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!token || loadedToken.current === token) return

    loadedToken.current = token

    const refresh = window.setTimeout(() => {
      void load(token, page, query, status, deliveryScope, dateFrom, dateTo)
    }, 0)

    return () => window.clearTimeout(refresh)
  }, [load, token, page, query, status, deliveryScope, dateFrom, dateTo])

  function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const nextToken = tokenInput.trim()
    if (!nextToken) return

    setError('')
    setFeedback('')
    loadedToken.current = null
    window.sessionStorage.setItem(adminTokenKey, nextToken)
    setToken(nextToken)
    setTokenInput('')
  }

  function logout() {
    window.sessionStorage.removeItem(adminTokenKey)
    loadedToken.current = null
    setToken('')
    setDeliveries([])
    setPage(1)
    setPageMeta({ total: 0, per_page: 20, current_page: 1, last_page: 1 })
  }

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPage(1)
    void load(token, 1, query, status, deliveryScope, dateFrom, dateTo)
  }

  function changePage(nextPage: number) {
    if (nextPage < 1 || nextPage > pageMeta.last_page || loading) return

    setPage(nextPage)
    void load(token, nextPage, query, status, deliveryScope, dateFrom, dateTo)
  }

  async function regenerate(delivery: AdminDeliverySummary) {
    const confirmed = window.confirm(
      `Gerar novos links para a carta de ${delivery.recipient_name}? `
      + 'Os links atuais deixarão de funcionar.',
    )

    if (!confirmed) return

    setBusyAction(`regenerate:${delivery.public_id}`)
    setError('')
    setFeedback('')

    try {
      const response = await regenerateAdminLinks(delivery.public_id, token)
      setLinks(response.data)
      setFeedback('Novos links gerados. Os links anteriores foram invalidados.')
    } catch {
      setError('Não foi possível gerar novos links.')
    } finally {
      setBusyAction(null)
    }
  }

  async function remove(delivery: AdminDeliverySummary) {
    const confirmed = window.confirm(
      `Apagar a carta de ${delivery.recipient_name}? Esta ação não pode ser desfeita.`,
    )

    if (!confirmed) return

    setBusyAction(`delete:${delivery.public_id}`)
    setError('')
    setFeedback('')

    try {
      const nextDeliveries = deliveries.filter((item) => item.public_id !== delivery.public_id)
      const nextTotal = Math.max(0, pageMeta.total - 1)
      const nextLastPage = Math.max(1, Math.ceil(nextTotal / pageMeta.per_page))
      const nextPage = Math.min(page, nextLastPage)

      await deleteAdminDelivery(delivery.public_id, token)
      setFeedback('Entrega excluída.')

      if (nextPage !== page || (nextDeliveries.length === 0 && nextTotal > 0)) {
        setPage(nextPage)
        await load(token, nextPage, query, status, deliveryScope, dateFrom, dateTo)
      } else {
        setDeliveries(nextDeliveries)
        setPageMeta((current) => ({
          ...current,
          total: nextTotal,
          last_page: nextLastPage,
          current_page: nextPage,
        }))
      }
    } catch {
      setError('Não foi possível apagar esta entrega.')
    } finally {
      setBusyAction(null)
    }
  }

  async function copyLink(kind: 'recipient' | 'sender', path: string) {
    try {
      const fullLink = new URL(path, window.location.origin).toString()
      await navigator.clipboard.writeText(fullLink)
      setCopiedLink(kind)
      setFeedback(`Link do ${kind === 'recipient' ? 'destinatário' : 'remetente'} copiado.`)
      window.setTimeout(() => setCopiedLink(null), 1800)
    } catch {
      setError('Não foi possível copiar o link. Abra-o e copie o endereço manualmente.')
    }
  }

  if (!token) {
    return (
      <main className="admin-page">
        <div className="admin-login">
          <button type="button" className="brand" onClick={onHome}>
            <span className="brand-mark" aria-hidden="true">✦</span>
            <span>Cartopia</span>
          </button>
          <p className="eyebrow">Área administrativa</p>
          <h1>Cartas em movimento.</h1>
          <p className="lead">
            Informe o token administrativo para acompanhar as entregas.
          </p>
          {error && <p className="error-message" role="alert">{error}</p>}
          <form onSubmit={login}>
            <label htmlFor="admin-token">Token administrativo</label>
            <input
              id="admin-token"
              type="password"
              autoComplete="current-password"
              required
              value={tokenInput}
              onChange={(event) => setTokenInput(event.target.value)}
            />
            <button className="button primary" type="submit">Entrar</button>
          </form>
        </div>
      </main>
    )
  }

  return (
    <main className="admin-page">
      <header className="admin-header">
        <div>
          <p className="eyebrow">Área administrativa</p>
          <h1>Cartas solicitadas</h1>
        </div>
        <div className="admin-actions">
          <button type="button" className="button secondary" onClick={onHome}>
            Ir para o Cartopia
          </button>
          <button type="button" className="text-button" onClick={logout}>Sair</button>
        </div>
      </header>

      <nav className="admin-view-tabs" aria-label="Seções administrativas">
        <button
          type="button"
          className={view === 'deliveries' ? 'active' : ''}
          aria-current={view === 'deliveries' ? 'page' : undefined}
          onClick={() => setView('deliveries')}
        >
          Entregas
        </button>
        <button
          type="button"
          className={view === 'users' ? 'active' : ''}
          aria-current={view === 'users' ? 'page' : undefined}
          onClick={() => setView('users')}
        >
          Usuários
        </button>
      </nav>

      {view === 'users' && (
        <AdminUsersPanel
          token={token}
          onUnauthorized={() => {
            window.sessionStorage.removeItem(adminTokenKey)
            loadedToken.current = null
            setToken('')
            setError('Token administrativo inválido ou expirado.')
          }}
        />
      )}

      {view === 'deliveries' && <form className="admin-toolbar" onSubmit={search}>
        <div className="admin-filter-row">
          <label>
            Buscar
            <input
              id="admin-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Destinatário, origem ou ID"
            />
          </label>
          <label>
            Status
            <select
              id="admin-status"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="">Todos os status</option>
              <option value="SCHEDULED">Agendadas</option>
              <option value="IN_TRANSIT">Em trânsito</option>
              <option value="DELIVERED">Entregues</option>
            </select>
          </label>
          <label>
            Criadas a partir de
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
            />
          </label>
          <label>
            Criadas até
            <input
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
            />
          </label>
        </div>
        <button type="submit" className="button secondary" disabled={loading}>
          {loading ? 'Filtrando…' : 'Aplicar filtros'}
        </button>
      </form>}

      {view === 'deliveries' && (
        <nav className="admin-delivery-tabs" aria-label="Escopo das entregas">
          <button
            type="button"
            className={deliveryScope === 'all' ? 'active' : ''}
            aria-current={deliveryScope === 'all' ? 'page' : undefined}
            onClick={() => {
              setDeliveryScope('all')
              setPage(1)
              void load(token, 1, query, status, 'all', dateFrom, dateTo)
            }}
          >
            Todas as entregas
          </button>
          <button
            type="button"
            className={deliveryScope === 'anonymous' ? 'active' : ''}
            aria-current={deliveryScope === 'anonymous' ? 'page' : undefined}
            onClick={() => {
              setDeliveryScope('anonymous')
              setPage(1)
              void load(token, 1, query, status, 'anonymous', dateFrom, dateTo)
            }}
          >
            Solicitações sem conta
          </button>
          <button
            type="button"
            className={deliveryScope === 'account' ? 'active' : ''}
            aria-current={deliveryScope === 'account' ? 'page' : undefined}
            onClick={() => {
              setDeliveryScope('account')
              setPage(1)
              void load(token, 1, query, status, 'account', dateFrom, dateTo)
            }}
          >
            Entregas de usuários
          </button>
        </nav>
      )}

      {view === 'deliveries' && error && <p className="error-message" role="alert">{error}</p>}
      {view === 'deliveries' && feedback && <p className="admin-feedback" role="status">{feedback}</p>}

      {view === 'deliveries' && links && (
        <section className="admin-links" aria-labelledby="admin-links-title">
          <strong id="admin-links-title">Novos links gerados</strong>
          <div className="admin-link-row">
            <a href={links.recipient_path} target="_blank" rel="noreferrer">
              Abrir link do destinatário
            </a>
            <button
              type="button"
              className="text-button"
              onClick={() => void copyLink('recipient', links.recipient_path)}
            >
              {copiedLink === 'recipient' ? 'Copiado' : 'Copiar link'}
            </button>
          </div>
          <div className="admin-link-row">
            <a href={links.sender_path} target="_blank" rel="noreferrer">
              Abrir link do remetente
            </a>
            <button
              type="button"
              className="text-button"
              onClick={() => void copyLink('sender', links.sender_path)}
            >
              {copiedLink === 'sender' ? 'Copiado' : 'Copiar link'}
            </button>
          </div>
          <button type="button" className="text-button" onClick={() => setLinks(null)}>
            Fechar
          </button>
        </section>
      )}

      {view === 'deliveries' && <section className="admin-list" aria-live="polite" aria-busy={loading}>
        {loading && <p role="status">Atualizando resultados…</p>}
        {!loading && !deliveries.length && (
          <p>
            {query || status || deliveryScope !== 'all' || dateFrom || dateTo
              ? 'Nenhuma entrega corresponde aos filtros atuais.'
              : 'Nenhuma entrega encontrada.'}
          </p>
        )}
        {deliveries.map((delivery) => {
          const actionBusy = busyAction?.endsWith(delivery.public_id) ?? false

          return (
            <article className="admin-delivery-card" key={delivery.public_id}>
              <div className="admin-delivery-main">
                <div>
                  <span className={`admin-status ${delivery.status.toLowerCase()}`}>
                    {statusLabels[delivery.status]}
                  </span>
                  {delivery.requester_type === 'anonymous' && (
                    <span className="admin-requester-badge">Solicitante sem conta</span>
                  )}
                  {delivery.requester_type === 'account' && (
                    <span className="admin-requester-badge account">Solicitante com conta</span>
                  )}
                  <h2>{delivery.recipient_name}</h2>
                  <p>{delivery.origin} → {delivery.destination}</p>
                </div>
                <strong aria-label={`${delivery.progress}% concluído`}>
                  {delivery.progress}%
                </strong>
              </div>
              <div className="admin-delivery-meta">
                <span>Remetente: {delivery.sender_name ?? 'Não informado'}</span>
                <span>ID: {delivery.public_id.slice(0, 8)}</span>
                <span>
                  {delivery.steps_count ? `${delivery.steps_count} paradas` : 'Entrega direta'}
                </span>
                <span>
                  {delivery.route_visibility === 'progressive'
                    ? 'Revelação progressiva'
                    : 'Rota completa'}
                </span>
                <span>Chegada: {formatDate(delivery.arrives_at)}</span>
              </div>
              <div className="admin-delivery-actions">
                <button
                  type="button"
                  className="button secondary"
                  disabled={loading || actionBusy}
                  onClick={() => void regenerate(delivery)}
                >
                  {busyAction === `regenerate:${delivery.public_id}`
                    ? 'Gerando…'
                    : 'Gerar novos links'}
                </button>
                <button
                  type="button"
                  className="text-button danger"
                  disabled={loading || actionBusy}
                  onClick={() => void remove(delivery)}
                >
                  {busyAction === `delete:${delivery.public_id}` ? 'Apagando…' : 'Apagar'}
                </button>
              </div>
            </article>
          )
        })}
      </section>}

      {view === 'deliveries' && pageMeta.last_page > 1 && (
        <nav className="admin-pagination" aria-label="Paginação de entregas">
          <button
            type="button"
            className="button secondary"
            disabled={pageMeta.current_page === 1 || loading}
            onClick={() => changePage(pageMeta.current_page - 1)}
          >
            ← Anterior
          </button>
          <span>
            Página {pageMeta.current_page} de {pageMeta.last_page} · {pageMeta.total} entregas
          </span>
          <button
            type="button"
            className="button secondary"
            disabled={pageMeta.current_page === pageMeta.last_page || loading}
            onClick={() => changePage(pageMeta.current_page + 1)}
          >
            Próxima →
          </button>
        </nav>
      )}
    </main>
  )
}
