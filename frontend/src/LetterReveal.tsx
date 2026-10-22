import { useState } from 'react'

type VisualState = 'closed' | 'opening' | 'opened'

interface LetterRevealProps {
  canOpen: boolean
  opening: boolean
  message: string | null
  error: string
  onOpen: () => void
}

function EnvelopeScene({ message, state, onOpened }: { message: string | null; state: VisualState; onOpened: () => void }) {
  return <div className={`letter-stage ${state}`}>
    {message !== null && <div className="letter-paper" onAnimationEnd={(event) => { if (event.animationName === 'paper-emerge') onOpened() }}>
      <p className="letter-label">Uma carta para você</p>
      <p className="letter-message">{message}</p>
      <span className="letter-signature">Com carinho, Cartopia ✦</span>
    </div>}
    <div className="envelope-body" aria-hidden="true">
      <span className="envelope-side envelope-side-left" />
      <span className="envelope-side envelope-side-right" />
      <span className="envelope-bottom" />
    </div>
    <div className="envelope-flap" aria-hidden="true"><span className="envelope-seal">✦</span></div>
  </div>
}

function initialVisualState(message: string | null): VisualState {
  if (message === null) return 'closed'

  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'opened' : 'opening'
}

export function LetterReveal({ canOpen, opening, message, error, onOpen }: LetterRevealProps) {
  const [visualState, setVisualState] = useState<VisualState>(() => initialVisualState(message))

  if (message !== null) {
    return <article className="letter-reveal-card" aria-live="polite">
      <EnvelopeScene message={message} state={visualState} onOpened={() => setVisualState('opened')} />
    </article>
  }

  if (canOpen) {
    return <section className="arrival-card" aria-live="polite">
      <img className="arrival-mascot" src="/couriers/paper-swallow.svg" alt="Andorinha de papel" />
      <p className="arrival-kicker">A aventura terminou</p>
      <h2>Sua surpresa chegou!</h2>
      <p>A mensagem está pronta para ser aberta.</p>
      <EnvelopeScene message={null} state="closed" onOpened={() => undefined} />
      <button className="button primary" type="button" disabled={opening} aria-busy={opening} onClick={onOpen}>{opening ? 'Abrindo minha carta…' : 'Abrir minha carta'}</button>
      {error && <p className="error-message" role="alert">{error}</p>}
    </section>
  }

  return <section className="message-card" aria-live="polite">
    <EnvelopeScene message={null} state="closed" onOpened={() => undefined} />
    <h2>A mensagem está viajando.</h2>
    <p>Quando a entrega chegar, você poderá abrir a carta.</p>
    <button className="button primary" type="button" disabled>Aguardando chegada</button>
    {error && <p className="error-message" role="alert">{error}</p>}
  </section>
}
