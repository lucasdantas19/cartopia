interface TrackingHeaderProps {
  recipientName: string
  senderName: string | null
  statusClass: string
  statusLabel: string
}

export function TrackingHeader({ recipientName, senderName, statusClass, statusLabel }: TrackingHeaderProps) {
  return <section className="tracking-header"><div><p className="tracking-kicker">Uma entrega para</p><h1>{recipientName}</h1><p className="lead">{senderName ? `${senderName} preparou uma surpresa para você.` : 'Alguém preparou uma surpresa para você.'}</p></div><div className={`status-pill ${statusClass}`}><span className="status-dot" />{statusLabel}</div></section>
}
