import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { ApiError, deleteAdminDelivery, fetchAdminDeliveries, regenerateAdminLinks } from '../services/api'
import type { AdminDeliverySummary, DeliveryStatus } from '../domain/delivery/types'

const adminTokenKey = 'cartopia:admin-token'
const statusLabels: Record<DeliveryStatus, string> = { SCHEDULED: 'Agendada', IN_TRANSIT: 'Em trânsito', DELIVERED: 'Entregue' }

interface AdminPageProps { onHome: () => void }

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
}

export function AdminPage({ onHome }: AdminPageProps) {
  const [token, setToken] = useState(() => window.sessionStorage.getItem(adminTokenKey) ?? '')
  const [tokenInput, setTokenInput] = useState('')
  const [deliveries, setDeliveries] = useState<AdminDeliverySummary[]>([])
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [pageMeta, setPageMeta] = useState({ total: 0, per_page: 20, current_page: 1, last_page: 1 })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [links, setLinks] = useState<{ recipient_path: string; sender_path: string } | null>(null)

  const load = useCallback(async (currentToken = token, currentPage = page) => {
    if (!currentToken) return
    setLoading(true); setError('')
    try {
      const response = await fetchAdminDeliveries(currentToken, query, status, currentPage)
      setDeliveries(response.data)
      setPageMeta(response.meta)
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        window.sessionStorage.removeItem(adminTokenKey); setToken(''); setError('Token administrativo inválido ou ausente.')
      } else setError('Não foi possível carregar as entregas.')
    } finally { setLoading(false) }
  }, [page, query, status, token])

  useEffect(() => {
    if (!token) return
    const refresh = window.setTimeout(() => { void load(token) }, 0)
    return () => window.clearTimeout(refresh)
  }, [load, token])

  function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); window.sessionStorage.setItem(adminTokenKey, tokenInput.trim()); setToken(tokenInput.trim()); setTokenInput('')
  }

  function logout() { window.sessionStorage.removeItem(adminTokenKey); setToken(''); setDeliveries([]); setPage(1) }

  function search() { setPage(1); void load(token, 1) }

  function changePage(nextPage: number) {
    if (nextPage < 1 || nextPage > pageMeta.last_page) return
    setPage(nextPage)
    void load(token, nextPage)
  }

  async function regenerate(publicId: string) {
    try { const response = await regenerateAdminLinks(publicId, token); setLinks(response.data) }
    catch { setError('Não foi possível gerar novos links.') }
  }

  async function remove(delivery: AdminDeliverySummary) {
    if (!window.confirm(`Apagar a carta de ${delivery.recipient_name}? Esta ação não pode ser desfeita.`)) return
    try { await deleteAdminDelivery(delivery.public_id, token); setDeliveries((current) => current.filter((item) => item.public_id !== delivery.public_id)) }
    catch { setError('Não foi possível apagar esta entrega.') }
  }

  if (!token) return <main className="admin-page"><div className="admin-login"><button type="button" className="brand" onClick={onHome}><span className="brand-mark" aria-hidden="true">✦</span><span>Cartopia</span></button><p className="eyebrow">Área administrativa</p><h1>Cartas em movimento.</h1><p className="lead">Informe o token administrativo para acompanhar as entregas.</p><form onSubmit={login}><label htmlFor="admin-token">Token administrativo</label><input id="admin-token" type="password" required value={tokenInput} onChange={(event) => setTokenInput(event.target.value)} /><button className="button primary" type="submit">Entrar</button></form></div></main>

  return <main className="admin-page"><header className="admin-header"><div><p className="eyebrow">Área administrativa</p><h1>Cartas solicitadas</h1></div><div className="admin-actions"><button type="button" className="button secondary" onClick={onHome}>Ir para o Cartopia</button><button type="button" className="text-button" onClick={logout}>Sair</button></div></header><section className="admin-toolbar"><input aria-label="Buscar entrega" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por destinatário, origem ou ID" /><select aria-label="Filtrar por status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Todos os status</option><option value="SCHEDULED">Agendadas</option><option value="IN_TRANSIT">Em trânsito</option><option value="DELIVERED">Entregues</option></select><button type="button" className="button secondary" onClick={search}>Buscar</button></section>{error && <p className="error-message" role="alert">{error}</p>}{links && <section className="admin-links"><strong>Novos links gerados</strong><a href={links.recipient_path} target="_blank" rel="noreferrer">Abrir link do destinatário</a><a href={links.sender_path} target="_blank" rel="noreferrer">Abrir link do remetente</a><button type="button" className="text-button" onClick={() => setLinks(null)}>Fechar</button></section>}<section className="admin-list" aria-live="polite">{loading && <p>Carregando entregas…</p>}{!loading && !deliveries.length && <p>Nenhuma entrega encontrada.</p>}{deliveries.map((delivery) => <article className="admin-delivery-card" key={delivery.public_id}><div className="admin-delivery-main"><div><span className={`admin-status ${delivery.status.toLowerCase()}`}>{statusLabels[delivery.status]}</span><h2>{delivery.recipient_name}</h2><p>{delivery.origin} → {delivery.destination}</p></div><strong>{delivery.progress}%</strong></div><div className="admin-delivery-meta"><span>{delivery.steps_count ? `${delivery.steps_count} paradas` : 'Entrega direta'}</span><span>{delivery.route_visibility === 'progressive' ? 'Revelação progressiva' : 'Rota completa'}</span><span>Chegada: {formatDate(delivery.arrives_at)}</span></div><div className="admin-delivery-actions"><button type="button" className="button secondary" onClick={() => { void regenerate(delivery.public_id) }}>Gerar novos links</button><button type="button" className="text-button danger" onClick={() => { void remove(delivery) }}>Apagar</button></div></article>)}</section>{pageMeta.last_page > 1 && <nav className="admin-pagination" aria-label="Paginação de entregas"><button type="button" className="button secondary" disabled={pageMeta.current_page === 1} onClick={() => changePage(pageMeta.current_page - 1)}>← Anterior</button><span>Página {pageMeta.current_page} de {pageMeta.last_page} · {pageMeta.total} entregas</span><button type="button" className="button secondary" disabled={pageMeta.current_page === pageMeta.last_page} onClick={() => changePage(pageMeta.current_page + 1)}>Próxima →</button></nav>}</main>
}
