interface TrackingHeaderProps {
  recipientName: string
  senderName: string | null
  accessRole: 'sender' | 'recipient'
  statusClass: string
  statusLabel: string
}

export function TrackingHeader({ recipientName, senderName, accessRole, statusClass, statusLabel }: TrackingHeaderProps) {
  return (
    <section className="tracking-header">
      <div>
        <p className="tracking-kicker">Acompanhando como {accessRole === 'sender' ? 'remetente' : 'destinatário'}</p>
        <h1>{recipientName}</h1>
        <p className="lead">
          {accessRole === 'sender'
            ? 'Veja o caminho da carta e saiba quando ela for aberta.'
            : senderName ? `${senderName} preparou uma surpresa para você.` : 'Alguém preparou uma surpresa para você.'}
        </p>
      </div>
      <div className={`status-pill ${statusClass}`}>
        <span className="status-dot" />
        {statusLabel}
      </div>
    </section>
  )
}
