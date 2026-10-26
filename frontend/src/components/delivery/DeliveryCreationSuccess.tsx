import type { AccessRole } from '../../domain/delivery/types'

interface CreatedDelivery {
  publicId: string
  recipientUrl: string
  senderUrl: string
  recipientToken: string
}

interface DeliveryCreationSuccessProps {
  created: CreatedDelivery
  copied: AccessRole | null
  copyError: AccessRole | null
  onCopy: (url: string, role: AccessRole) => void
  onTrack: (publicId: string, token: string) => void
  onCreateAnother: () => void
}

export function DeliveryCreationSuccess({ created, copied, copyError, onCopy, onTrack, onCreateAnother }: DeliveryCreationSuccessProps) {
  return <section className="success-card"><span className="success-icon">✉</span><h1>Uma carta partiu!</h1><p className="lead">A rota foi traçada. Guarde os dois links: cada um possui uma permissão diferente.</p>
    <div className="share-box"><div><label htmlFor="recipient-share-link"><strong>Link do destinatário</strong></label><small className="share-hint">Envie este link para quem receberá a carta.</small><input id="recipient-share-link" className="share-link" readOnly value={created.recipientUrl} onFocus={(event) => event.currentTarget.select()} onClick={(event) => event.currentTarget.select()} /></div><button className="button secondary" type="button" onClick={() => onCopy(created.recipientUrl, 'recipient')}>{copied === 'recipient' ? 'Copiado!' : 'Copiar link'}</button></div>
    <div className="share-box"><div><label htmlFor="sender-share-link"><strong>Link do remetente</strong></label><small className="share-hint">Guarde para acompanhar e saber quando a carta for aberta.</small><input id="sender-share-link" className="share-link" readOnly value={created.senderUrl} onFocus={(event) => event.currentTarget.select()} onClick={(event) => event.currentTarget.select()} /></div><button className="button secondary" type="button" onClick={() => onCopy(created.senderUrl, 'sender')}>{copied === 'sender' ? 'Copiado!' : 'Copiar link'}</button></div>
    {copyError && <p className="error-message" role="alert">Não foi possível copiar automaticamente. Selecione o link acima e copie manualmente.</p>}
    <div className="success-actions"><button className="button primary" type="button" onClick={() => onTrack(created.publicId, created.recipientToken)}>Acompanhar como destinatário</button><button className="text-button" type="button" onClick={onCreateAnother}>Criar outra carta</button></div>
  </section>
}
