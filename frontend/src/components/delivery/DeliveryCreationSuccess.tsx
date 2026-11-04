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
      <span className="success-icon">✉</span>
      <h1>Uma carta partiu!</h1>
      <p className="lead">Agora envie o link para quem receberá a surpresa.</p>
      <button className="button primary" type="button" onClick={() => void shareRecipientLink()}>
        Compartilhar com o destinatário
      </button>
      <div className="share-box">
        <div>
          <label htmlFor="recipient-share-link">Envie este link</label>
          <input id="recipient-share-link" className="share-link" readOnly value={created.recipientUrl} onFocus={(event) => event.currentTarget.select()} />
        </div>
        <button className="button secondary" type="button" onClick={() => onCopy(created.recipientUrl, 'recipient')}>
          {copied === 'recipient' ? 'Copiado!' : 'Copiar link'}
        </button>
      </div>
      <div className="success-actions">
        <button className="button secondary" type="button" onClick={() => onTrack(created.publicId, created.senderToken, 'sender')}>
          Acompanhar minha entrega
        </button>
      </div>
      <details>
        <summary>Seu link de acompanhamento e outras opções</summary>
        <p>Guarde este link para acompanhar a viagem e saber quando a carta for aberta.</p>
        <div className="share-box">
          <input aria-label="Seu link de acompanhamento" className="share-link" readOnly value={created.senderUrl} onFocus={(event) => event.currentTarget.select()} />
          <button className="button secondary" type="button" onClick={() => onCopy(created.senderUrl, 'sender')}>
            {copied === 'sender' ? 'Copiado!' : 'Copiar meu link'}
          </button>
        </div>
        <button className="text-button" type="button" onClick={() => onTrack(created.publicId, created.recipientToken, 'recipient')}>
          Ver como destinatário
        </button>
      </details>
      {copied && <p role="status">Link copiado.</p>}
      {copyError && <p className="error-message" role="alert">Selecione o link acima e copie manualmente.</p>}
      <button className="text-button" type="button" onClick={onCreateAnother}>
        Criar outra carta
      </button>
    </section>
  )
}
