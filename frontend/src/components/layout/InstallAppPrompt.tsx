import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

const dismissedStorageKey = 'cartopia.install-prompt-dismissed'

export function InstallAppPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches || window.localStorage.getItem(dismissedStorageKey)) return

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setInstallEvent(event as BeforeInstallPromptEvent)
      setVisible(true)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
  }, [])

  async function install() {
    if (!installEvent) return
    await installEvent.prompt()
    const choice = await installEvent.userChoice
    if (choice.outcome === 'accepted') setVisible(false)
    setInstallEvent(null)
  }

  function dismiss() {
    window.localStorage.setItem(dismissedStorageKey, 'true')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <aside className="install-prompt" aria-label="Instalar Cartopia">
      <span className="install-prompt-icon" aria-hidden="true">✦</span>
      <div>
        <strong>Leve a Cartopia com você</strong>
        <p>Instale o app para criar e acompanhar suas cartas pelo celular.</p>
      </div>
      <button className="button primary" type="button" onClick={() => { void install() }}>
        Instalar
      </button>
      <button className="install-prompt-close" type="button" onClick={dismiss} aria-label="Fechar aviso de instalação">
        ×
      </button>
    </aside>
  )
}
