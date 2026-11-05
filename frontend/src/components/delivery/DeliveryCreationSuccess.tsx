import type { AccessRole } from '../../domain/delivery/types'

interface CreatedDelivery {
  publicId: string
  recipientUrl: string
  senderUrl: string
  recipientToken: string
  senderToken: string
}

interface DeliveryCreationSuccessProps {
  created: CreatedDelivery
  copied: AccessRole | null
  copyError: AccessRole | null
  onCopy: (url: string, role: AccessRole) => void
  onTrack: (publicId: string, token: string, role?: AccessRole) => void
  onCreateAnother: () => void
}

export function DeliveryCreationSuccess({ created, copied, copyError, onCopy, onTrack, onCreateAnother }: DeliveryCreationSuccessProps) {
  async function shareRecipientLink() {
    if (!navigator.share) {
      onCopy(created.recipientUrl, 'recipient')
      return
    }
    try {
      await navigator.share({ title: 'Uma carta para você', url: created.recipientUrl })
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        onCopy(created.recipientUrl, 'recipient')
      }
    }
  }

  return (
    <section className="success-card">
      <header className="success-confirmation">
        <span className="success-icon" aria-hidden="true">✉</span>
        <p className="success-kicker">A aventura está em andamento</p>
        <h1>Uma carta partiu!</h1>
        <p className="lead">Sua carta já está a caminho. Compartilhe o link para que alguém especial acompanhe a surpresa.</p>
      </header>

      <section className="success-share-section" aria-labelledby="success-share-title">
        <h2 id="success-share-title">Compartilhe a surpresa</h2>
        <button className="button primary" type="button" onClick={() => void shareRecipientLink()}>
          Compartilhar com o destinatário
        </button>
        <div className="share-box">
          <div>
            <label htmlFor="recipient-share-link">Ou envie este link</label>
            <input id="recipient-share-link" className="share-link" readOnly value={created.recipientUrl} onFocus={(event) => event.currentTarget.select()} />
          </div>
          <button className="button secondary" type="button" onClick={() => onCopy(created.recipientUrl, 'recipient')}>
            {copied === 'recipient' ? 'Link copiado!' : 'Copiar link'}
          </button>
        </div>
      </section>

      <section className="success-tracking-section" aria-labelledby="success-tracking-title">
        <div className="success-tracking-heading">
          <span className="success-tracking-icon" aria-hidden="true">⌁</span>
          <div>
            <h2 id="success-tracking-title">Acompanhar minha entrega</h2>
            <p>Veja por onde sua carta está passando.</p>
          </div>
        </div>
        <button className="button secondary" type="button" onClick={() => onTrack(created.publicId, created.senderToken, 'sender')}>
          Acompanhar minha entrega
        </button>
        <details className="success-more-options">
          <summary>Outras opções de acompanhamento</summary>
          <p>Guarde este link para acompanhar a viagem e saber quando a carta for aberta.</p>
          <div className="share-box">
            <input aria-label="Seu link de acompanhamento" className="share-link" readOnly value={created.senderUrl} onFocus={(event) => event.currentTarget.select()} />
            <button className="button secondary" type="button" onClick={() => onCopy(created.senderUrl, 'sender')}>
              {copied === 'sender' ? 'Link copiado!' : 'Copiar meu link'}
            </button>
          </div>
          <button className="text-button" type="button" onClick={() => onTrack(created.publicId, created.recipientToken, 'recipient')}>
            Ver como destinatário
          </button>
        </details>
      </section>

      {copied && <p className="success-feedback" role="status" aria-live="polite">Link copiado!</p>}
      {copyError && <p className="error-message" role="alert" aria-live="assertive">Selecione o link acima e copie manualmente.</p>}
      <button className="text-button success-create-another" type="button" onClick={onCreateAnother}>
        Criar outra carta
      </button>
    </section>
  )
}
