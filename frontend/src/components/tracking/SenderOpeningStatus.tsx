import { formatLocalDate } from '../../utils/dateTime'

interface SenderOpeningStatusProps {
  openedAt: string | null
  challengeLocked?: boolean
  resettingChallenge?: boolean
  onResetChallenge?: () => void
}

export function SenderOpeningStatus({ openedAt, challengeLocked = false, resettingChallenge = false, onResetChallenge }: SenderOpeningStatusProps) {
  if (challengeLocked) return <section className="message-card sender-opening-card" aria-live="polite"><span className="lock-icon" aria-hidden="true">✦</span><h2>O destinatário precisa da sua ajuda</h2><p>As tentativas do desafio acabaram. Libere uma nova rodada para que a carta possa ser aberta.</p><button className="button primary" type="button" disabled={resettingChallenge} onClick={onResetChallenge}>{resettingChallenge ? 'Liberando…' : 'Liberar nova tentativa'}</button></section>
  return <section className="message-card sender-opening-card" aria-live="polite">
    <span className="lock-icon" aria-hidden="true">{openedAt ? '✓' : '✦'}</span>
    <h2>{openedAt ? 'A carta encontrou seu destino!' : 'O próximo capítulo aguarda'}</h2>
    <p>{openedAt ? 'O destinatário abriu sua carta em ' + formatLocalDate(openedAt) + '.' : 'O carimbo final aparece aqui assim que o destinatário abrir a carta.'}</p>
  </section>
}
