import { PrivacyPage } from './PrivacyPage'
import { Shell } from '../components/layout/Shell'

interface PrivacyPageShellProps {
  onHome: () => void
  onPrivacy: () => void
}

export function PrivacyPageShell({ onHome, onPrivacy }: PrivacyPageShellProps) {
  return <Shell eyebrow="Transparência do Cartopia" onHome={onHome} onPrivacy={onPrivacy}>
    <PrivacyPage />
    <button className="text-button privacy-home-link" type="button" onClick={onHome}>Voltar ao início</button>
  </Shell>
}
