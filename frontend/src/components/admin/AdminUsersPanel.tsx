import { useEffect, useState, type FormEvent } from 'react'
import { ApiError, fetchAdminUser, fetchAdminUsers } from '../../services/api'
import type {
  AdminUserDelivery,
  AdminUserDetails,
  AdminUserSummary,
} from '../../domain/delivery/types'

interface AdminUsersPanelProps {
  token: string
  onUnauthorized: () => void
}

const statusLabels = {
  SCHEDULED: 'Agendada',
  IN_TRANSIT: 'Em trânsito',
  DELIVERED: 'Entregue',
} as const

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

function UserDeliveryList({ deliveries, emptyMessage }: {
  deliveries: AdminUserDelivery[]
  emptyMessage: string
}) {
  if (!deliveries.length) return <p className="admin-users-empty">{emptyMessage}</p>

  return (
    <div className="admin-user-delivery-list">
      {deliveries.map((delivery) => (
        <article className="admin-user-delivery" key={delivery.public_id}>
          <div>
            <span className={`admin-status ${delivery.status.toLowerCase()}`}>
              {statusLabels[delivery.status]}
            </span>
            <h4>{delivery.origin} → {delivery.destination}</h4>
            <p>
              {delivery.recipient_name}
              {delivery.recipient_email ? ` · ${delivery.recipient_email}` : ''}
            </p>
          </div>
          <div className="admin-user-delivery-meta">
            <strong>{delivery.progress}%</strong>
            <span>Chegada: {formatDate(delivery.arrives_at)}</span>
          </div>
        </article>
      ))}
    </div>
  )
}

type UserDetailTab = 'overview' | 'locations' | 'sent' | 'received' | 'tracked'

export function AdminUsersPanel({ token, onUnauthorized }: AdminUsersPanelProps) {
  const [users, setUsers] = useState<AdminUserSummary[]>([])
  const [selectedUser, setSelectedUser] = useState<AdminUserDetails | null>(null)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [meta, setMeta] = useState({ total: 0, current_page: 1, last_page: 1 })
  const [loading, setLoading] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState('')
  const [detailTab, setDetailTab] = useState<UserDetailTab>('overview')

  async function loadUsers(currentPage = page, currentQuery = query) {
    setLoading(true)
    setError('')

    try {
      const response = await fetchAdminUsers(token, currentQuery, currentPage)
      setUsers(response.data)
      setMeta(response.meta)
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        onUnauthorized()
      } else {
        setError('Não foi possível carregar os usuários.')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadUsers(1, '')
    // A troca de token desmonta a tela administrativa; a carga inicial é intencional.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPage(1)
    void loadUsers(1, query)
  }

  async function selectUser(user: AdminUserSummary) {
    setDetailLoading(true)
    setError('')

    try {
      const response = await fetchAdminUser(user.id, token)
      setSelectedUser(response.data)
      setDetailTab('overview')
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        onUnauthorized()
      } else {
        setError('Não foi possível carregar os dados deste usuário.')
      }
    } finally {
      setDetailLoading(false)
    }
  }

  function changePage(nextPage: number) {
    if (nextPage < 1 || nextPage > meta.last_page || loading) return

    setPage(nextPage)
    void loadUsers(nextPage, query)
  }

  return (
    <section className="admin-users" aria-labelledby="admin-users-title">
      <div className="admin-users-heading">
        <div>
          <p className="eyebrow">Cadastros e relacionamento</p>
          <h2 id="admin-users-title">Usuários cadastrados</h2>
          <p>Consulte locais salvos e entregas relacionadas a cada conta.</p>
        </div>
        <span className="admin-users-count">{meta.total} usuários</span>
      </div>

      <form className="admin-users-search" onSubmit={search}>
        <label className="sr-only" htmlFor="admin-user-search">Buscar usuário</label>
        <input
          id="admin-user-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar por nome ou e-mail"
        />
        <button type="submit" className="button secondary" disabled={loading}>
          {loading ? 'Buscando…' : 'Buscar'}
        </button>
      </form>

      {error && <p className="error-message" role="alert">{error}</p>}

      <div className="admin-users-layout">
        <div className="admin-user-list" aria-live="polite" aria-busy={loading}>
          {loading && <p role="status">Carregando usuários…</p>}
          {!loading && !users.length && <p className="admin-users-empty">Nenhum usuário encontrado.</p>}
          {users.map((user) => (
            <button
              type="button"
              className={`admin-user-row ${selectedUser?.id === user.id ? 'selected' : ''}`}
              key={user.id}
              onClick={() => void selectUser(user)}
            >
              <strong>{user.name}</strong>
              <span>{user.email}</span>
              <small>
                {user.locations_count} locais · {user.sent_deliveries_count} enviadas · {user.received_deliveries_count} recebidas · {user.tracked_deliveries_count} acompanhadas
              </small>
            </button>
          ))}
        </div>

        <div className="admin-user-detail" aria-live="polite" aria-busy={detailLoading}>
          {detailLoading && <p role="status">Carregando dados do usuário…</p>}
          {!detailLoading && !selectedUser && (
            <div className="admin-users-empty admin-user-detail-placeholder">
              <strong>Selecione um usuário</strong>
              <p>Os locais salvos e as entregas aparecerão aqui.</p>
            </div>
          )}
          {!detailLoading && selectedUser && (
            <>
              <header className="admin-user-detail-header">
                <div>
                  <p className="eyebrow">Usuário #{selectedUser.id}</p>
                  <h3>{selectedUser.name}</h3>
                  <p>{selectedUser.email}</p>
                  <small className="admin-user-contact-setting">
                    {selectedUser.allow_contact_delivery
                      ? 'Aceita entregas de contatos'
                      : 'Não aceita entregas de contatos'}
                  </small>
                </div>
                <span>
                  Cadastro: {formatDate(selectedUser.created_at)}
                </span>
              </header>

              <div className="admin-user-stats">
                <span><strong>{selectedUser.locations.length}</strong> locais salvos</span>
                <span><strong>{selectedUser.sent_deliveries_count}</strong> enviadas</span>
                <span><strong>{selectedUser.received_deliveries_count}</strong> recebidas</span>
                <span><strong>{selectedUser.tracked_deliveries_count}</strong> acompanhadas</span>
              </div>

              <nav className="admin-user-subnav" aria-label={`Dados de ${selectedUser.name}`}>
                {[
                  ['overview', 'Resumo'],
                  ['locations', 'Locais'],
                  ['sent', 'Enviadas'],
                  ['received', 'Recebidas'],
                  ['tracked', 'Acompanhadas'],
                ].map(([tab, label]) => (
                  <button
                    type="button"
                    className={detailTab === tab ? 'active' : ''}
                    aria-current={detailTab === tab ? 'page' : undefined}
                    key={tab}
                    onClick={() => setDetailTab(tab as UserDetailTab)}
                  >
                    {label}
                  </button>
                ))}
              </nav>

              {detailTab === 'overview' && (
                <section className="admin-user-detail-section admin-user-overview" aria-labelledby="admin-user-overview-title">
                  <h4 id="admin-user-overview-title">Resumo operacional</h4>
                  <p>
                    Esta conta possui {selectedUser.locations_count} locais salvos,
                    {' '}{selectedUser.sent_deliveries_count} entregas enviadas,
                    {' '}{selectedUser.received_deliveries_count} recebidas e
                    {' '}{selectedUser.tracked_deliveries_count} acompanhadas.
                  </p>
                </section>
              )}

              {detailTab === 'locations' && <section className="admin-user-detail-section" aria-labelledby="admin-user-locations-title">
                <h4 id="admin-user-locations-title">Locais salvos</h4>
                {!selectedUser.locations.length && <p className="admin-users-empty">Nenhum local salvo.</p>}
                {!!selectedUser.locations.length && (
                  <div className="admin-location-list">
                    {selectedUser.locations.map((location) => (
                      <article className="admin-location-item" key={location.id}>
                        <strong>{location.name}</strong>
                        <span>{location.label}</span>
                        {location.is_default && <small>Local padrão</small>}
                      </article>
                    ))}
                  </div>
                )}
              </section>}

              {detailTab === 'sent' && <section className="admin-user-detail-section" aria-labelledby="admin-user-sent-title">
                <h4 id="admin-user-sent-title">
                  Entregas enviadas
                  {selectedUser.sent_deliveries_count > selectedUser.sent_deliveries.length
                    ? ' (últimas 50)'
                    : ''}
                </h4>
                <UserDeliveryList
                  deliveries={selectedUser.sent_deliveries}
                  emptyMessage="Nenhuma entrega enviada por este usuário."
                />
              </section>}

              {detailTab === 'received' && <section className="admin-user-detail-section" aria-labelledby="admin-user-received-title">
                <h4 id="admin-user-received-title">
                  Entregas recebidas
                  {selectedUser.received_deliveries_count > selectedUser.received_deliveries.length
                    ? ' (últimas 50)'
                    : ''}
                </h4>
                <UserDeliveryList
                  deliveries={selectedUser.received_deliveries}
                  emptyMessage="Nenhuma entrega associada como recebida."
                />
              </section>}

              {detailTab === 'tracked' && (
                <section className="admin-user-detail-section" aria-labelledby="admin-user-tracked-title">
                  <h4 id="admin-user-tracked-title">Entregas acompanhadas</h4>
                  {!selectedUser.tracked_deliveries.length && (
                    <p className="admin-users-empty">Nenhuma entrega acompanhada.</p>
                  )}
                  {!!selectedUser.tracked_deliveries.length && (
                    <div className="admin-user-delivery-list">
                      {selectedUser.tracked_deliveries.map((delivery) => (
                        <article className="admin-user-delivery" key={delivery.id}>
                          <div>
                            <span className={`admin-status ${delivery.status.toLowerCase()}`}>
                              {statusLabels[delivery.status]}
                            </span>
                            <h4>{delivery.label || `${delivery.origin} → ${delivery.destination}`}</h4>
                            <p>
                              {delivery.origin} → {delivery.destination}
                              {' · '}{delivery.role === 'sender' ? 'Acesso de remetente' : 'Acesso de destinatário'}
                            </p>
                          </div>
                          <div className="admin-user-delivery-meta">
                            <strong>{delivery.progress}%</strong>
                            <span>Chegada: {formatDate(delivery.arrives_at)}</span>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              )}
            </>
          )}
        </div>
      </div>

      {meta.last_page > 1 && (
        <nav className="admin-pagination" aria-label="Paginação de usuários">
          <button
            type="button"
            className="button secondary"
            disabled={meta.current_page === 1 || loading}
            onClick={() => changePage(meta.current_page - 1)}
          >
            ← Anterior
          </button>
          <span>Página {meta.current_page} de {meta.last_page}</span>
          <button
            type="button"
            className="button secondary"
            disabled={meta.current_page === meta.last_page || loading}
            onClick={() => changePage(meta.current_page + 1)}
          >
            Próxima →
          </button>
        </nav>
      )}
    </section>
  )
}
