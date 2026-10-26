import { formatLocalDate } from '../../utils/dateTime'

interface SenderOpeningStatusProps {
  openedAt: string | null
}

export function SenderOpeningStatus({ openedAt }: SenderOpeningStatusProps) {
  return <section className="message-card sender-opening-card" aria-live="polite">
    <span className="lock-icon" aria-hidden="true">{openedAt ? '✓' : '✦'}</span>
    <h2>{openedAt ? 'A carta encontrou seu destino!' : 'O próximo capítulo aguarda'}</h2>
    <p>{openedAt ? 'O destinatário abriu sua carta em ' + formatLocalDate(openedAt) + '.' : 'O carimbo final aparece aqui assim que o destinatário abrir a carta.'}</p>
  </section>
}
