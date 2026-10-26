interface ErrorStateProps {
  message: string
  onHome: () => void
  onRetry?: () => void
}

export function ErrorState({ message, onHome, onRetry }: ErrorStateProps) {
  return <div className="state-card">
    <span className="state-icon">?</span>
    <h1>{onRetry ? 'A bússola perdeu o sinal.' : 'Essa rota não foi encontrada.'}</h1>
    <p className="lead">{message}</p>
    {onRetry && <button className="button primary" type="button" onClick={onRetry}>Tentar novamente</button>}
    <button className="button secondary" type="button" onClick={onHome}>Voltar ao início</button>
  </div>
}
