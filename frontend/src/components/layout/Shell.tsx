import type { ReactNode } from 'react'
import { InstallAppPrompt } from './InstallAppPrompt'

interface ShellProps {
  children: ReactNode
  eyebrow?: string
  onHome: () => void
  onPrivacy: () => void
  onAccount?: () => void
}

export function Shell({ children, eyebrow = 'Cartas que atravessam mundos', onHome, onPrivacy, onAccount }: ShellProps) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" type="button" onClick={onHome} aria-label="Voltar para o início">
          <span className="brand-mark" aria-hidden="true"><span>✦</span></span>
          <span>Cartopia</span>
        </button>
        <span className="topbar-note">
          <span className="topbar-route" aria-hidden="true"><i /><b>· · ·</b><i /></span>
          Cada mensagem, uma aventura.
        </span>
        {onAccount && <button className="text-button account-link" type="button" onClick={onAccount}>Minha conta</button>}
      </header>
      <main className="page-content">
        <p className="eyebrow">{eyebrow}</p>
        {children}
      </main>
      <InstallAppPrompt />
      <footer>
        Feito para transformar carinho em caminho.{' '}
        <a className="footer-link" href="/privacidade" onClick={(event) => { event.preventDefault(); onPrivacy() }}>
          Política de Privacidade
        </a>
      </footer>
    </div>
  )
}
