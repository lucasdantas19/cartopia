import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { ApiError, deleteLocation, deleteRecipient, fetchAccount, getAuthToken, logout, saveLocation, saveRecipient, setAuthToken, type AccountDelivery, type AuthUser, type SavedLocation, type SavedRecipient } from '../services/api'
import { Shell } from '../components/layout/Shell'

interface AccountPageProps { onHome: () => void; onPrivacy: () => void; onLogout: () => void }

export function AccountPage({ onHome, onPrivacy, onLogout }: AccountPageProps) {
  const [account, setAccount] = useState<{ user: AuthUser; deliveries: AccountDelivery[]; locations: SavedLocation[]; recipients: SavedRecipient[] } | null>(null)
  const [error, setError] = useState('')
  const [location, setLocation] = useState({ name: '', label: '', latitude: '', longitude: '' })
  const [recipient, setRecipient] = useState({ name: '', nickname: '' })

  async function refresh() {
    try { const data = await fetchAccount(); setAccount({ user: data, deliveries: data.deliveries, locations: data.locations, recipients: data.recipients }) }
    catch (caught) { setError(caught instanceof ApiError ? caught.message : 'Não foi possível carregar sua conta.') }
  }
  useEffect(() => { void refresh() }, [])

  async function signOut() { await logout().catch(() => undefined); setAuthToken(null); onLogout() }
  async function addLocation(event: FormEvent) { event.preventDefault(); await saveLocation({ ...location, latitude: Number(location.latitude), longitude: Number(location.longitude) }); setLocation({ name: '', label: '', latitude: '', longitude: '' }); await refresh() }
  async function addRecipient(event: FormEvent) { event.preventDefault(); await saveRecipient(recipient); setRecipient({ name: '', nickname: '' }); await refresh() }

  if (!getAuthToken()) return null
  return <Shell eyebrow="Seu atlas de lembranças" onHome={onHome} onPrivacy={onPrivacy}>
    <section className="account-header"><div><p className="eyebrow">Conta</p><h1>{account?.user.name ?? 'Carregando…'}</h1><p className="lead">{account?.user.email}</p></div><button className="text-button" type="button" onClick={() => { void signOut() }}>Sair</button></section>
    {error && <p className="error-message" role="alert">{error}</p>}
    <section className="account-section"><h2>Histórico de envios</h2>{account?.deliveries.length ? account.deliveries.map((delivery) => <article className="account-item" key={delivery.public_id}><strong>{delivery.recipient_name}</strong><span>{delivery.origin} → {delivery.destination}</span><small>{delivery.status} · {delivery.progress}%</small></article>) : <p className="muted-copy">Seus próximos envios aparecerão aqui. Criar uma entrega continua possível sem login.</p>}</section>
    <div className="account-columns"><section className="account-section"><h2>Lugares salvos</h2>{account?.locations.map((item) => <article className="account-item" key={item.id}><strong>{item.name}</strong><span>{item.label}</span><button className="text-button danger" type="button" onClick={() => { void deleteLocation(item.id).then(refresh) }}>Apagar</button></article>)}<form className="account-form compact" onSubmit={addLocation}><input required placeholder="Nome do lugar" value={location.name} onChange={(event) => setLocation({ ...location, name: event.target.value })} /><input required placeholder="Endereço ou descrição" value={location.label} onChange={(event) => setLocation({ ...location, label: event.target.value })} /><div className="field-grid"><input required type="number" step="any" placeholder="Latitude" value={location.latitude} onChange={(event) => setLocation({ ...location, latitude: event.target.value })} /><input required type="number" step="any" placeholder="Longitude" value={location.longitude} onChange={(event) => setLocation({ ...location, longitude: event.target.value })} /></div><button className="button secondary" type="submit">Salvar lugar</button></form></section><section className="account-section"><h2>Destinatários salvos</h2>{account?.recipients.map((item) => <article className="account-item" key={item.id}><strong>{item.name}</strong><span>{item.nickname || 'Sem apelido'}</span><button className="text-button danger" type="button" onClick={() => { void deleteRecipient(item.id).then(refresh) }}>Apagar</button></article>)}<form className="account-form compact" onSubmit={addRecipient}><input required placeholder="Nome do destinatário" value={recipient.name} onChange={(event) => setRecipient({ ...recipient, name: event.target.value })} /><input placeholder="Apelido (opcional)" value={recipient.nickname} onChange={(event) => setRecipient({ ...recipient, nickname: event.target.value })} /><button className="button secondary" type="submit">Salvar destinatário</button></form></section></div>
  </Shell>
}
