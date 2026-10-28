import { useState } from 'react'
import type { FormEvent } from 'react'
import { ApiError, login, register, setAuthToken } from '../services/api'
import { Shell } from '../components/layout/Shell'

interface AuthPageProps { onHome: () => void; onPrivacy: () => void; onAuthenticated: () => void }

export function AuthPage({ onHome, onPrivacy, onAuthenticated }: AuthPageProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setLoading(true)
    try {
      const response = mode === 'login' ? await login({ email, password }) : await register({ name, email, password })
      setAuthToken(response.token); onAuthenticated()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Não foi possível concluir o acesso.')
    } finally { setLoading(false) }
  }

  return <Shell eyebrow="Sua caixa de lembranças" onHome={onHome} onPrivacy={onPrivacy}>
    <section className="account-card">
      <p className="eyebrow">{mode === 'login' ? 'Bem-vindo de volta' : 'Criar uma conta'}</p>
      <h1>{mode === 'login' ? 'Continue sua viagem.' : 'Guarde suas viagens.'}</h1>
      <p className="lead">O login é opcional. Ele serve para reunir seus envios e salvar pessoas e lugares para a próxima aventura.</p>
      <form className="account-form" onSubmit={submit}>
        {mode === 'register' && <><label htmlFor="auth-name">Seu nome</label><input id="auth-name" required value={name} onChange={(event) => setName(event.target.value)} /></>}
        <label htmlFor="auth-email">E-mail</label><input id="auth-email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
        <label htmlFor="auth-password">Senha</label><input id="auth-password" type="password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} />
        {error && <p className="error-message" role="alert">{error}</p>}
        <button className="button primary" type="submit" disabled={loading}>{loading ? 'Aguarde…' : mode === 'login' ? 'Entrar' : 'Criar conta'}</button>
      </form>
      <button className="text-button" type="button" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}>
        {mode === 'login' ? 'Ainda não tenho uma conta' : 'Já tenho uma conta'}
      </button>
    </section>
  </Shell>
}
