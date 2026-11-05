import { useState } from 'react'
import type { FormEvent } from 'react'
import { ApiError, login, register, setAuthToken } from '../services/api'
import { Shell } from '../components/layout/Shell'
import { isPasswordStrongEnough, passwordRequirements } from '../utils/passwordRequirements'

interface AuthPageProps { onHome: () => void; onPrivacy: () => void; onAuthenticated: () => void }

export function AuthPage({ onHome, onPrivacy, onAuthenticated }: AuthPageProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [fieldError, setFieldError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setFieldError('')
    if (mode === 'register' && !isPasswordStrongEnough(password)) {
      setFieldError('A senha ainda não atende a todos os requisitos.')
      return
    }
    setLoading(true)
    try {
      const response = mode === 'login' ? await login({ email, password }) : await register({ name, email, password })
      setAuthToken(response.token); onAuthenticated()
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.message)
        setFieldError(caught.fields?.password?.[0] ?? '')
      } else {
        setError('Não foi possível concluir o acesso.')
      }
    } finally {
      setLoading(false)
    }
  }

  return <Shell eyebrow="Sua caixa de lembranças" onHome={onHome} onPrivacy={onPrivacy}>
    <section className="account-card">
      <p className="eyebrow">{mode === 'login' ? 'Bem-vindo de volta' : 'Criar uma conta'}</p>
      <h1>{mode === 'login' ? 'Continue sua viagem.' : 'Guarde suas viagens.'}</h1>
      <p className="lead">O login é opcional. Ele serve para reunir seus envios e salvar pessoas e lugares para a próxima aventura.</p>
      <form className="account-form" onSubmit={submit} noValidate>
        {mode === 'register' && (
          <>
            <label htmlFor="auth-name">Seu nome</label>
            <input id="auth-name" autoComplete="name" required value={name} onChange={(event) => setName(event.target.value)} />
          </>
        )}
        <label htmlFor="auth-email">E-mail</label>
        <input id="auth-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
        <label htmlFor="auth-password">Senha</label>
        <div className="password-field">
          <input
            id="auth-password"
            type={showPassword ? 'text' : 'password'}
            autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            minLength={8}
            required
            aria-describedby={mode === 'register' ? 'password-requirements' : undefined}
            aria-invalid={Boolean(fieldError)}
            value={password}
            onChange={(event) => {
              setPassword(event.target.value)
              setFieldError('')
            }}
          />
          <button type="button" className="password-toggle" onClick={() => setShowPassword((current) => !current)}>
            {showPassword ? 'Ocultar' : 'Mostrar'}
          </button>
        </div>
        {mode === 'register' && (
          <ul className="password-requirements" id="password-requirements" aria-label="Requisitos da senha">
            {passwordRequirements(password).map((requirement) => (
              <li className={requirement.valid ? 'valid' : ''} key={requirement.key}>
                <span aria-hidden="true">{requirement.valid ? '✓' : '○'}</span>
                {requirement.label}
              </li>
            ))}
          </ul>
        )}
        {fieldError && <p className="field-error" role="alert">{fieldError}</p>}
        {error && <p className="error-message" role="alert">{error}</p>}
        <button className="button primary" type="submit" disabled={loading}>{loading ? 'Aguarde…' : mode === 'login' ? 'Entrar' : 'Criar conta'}</button>
      </form>
      <button className="text-button" type="button" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); setFieldError(''); setPassword(''); setShowPassword(false) }}>
        {mode === 'login' ? 'Ainda não tenho uma conta' : 'Já tenho uma conta'}
      </button>
    </section>
  </Shell>
}
