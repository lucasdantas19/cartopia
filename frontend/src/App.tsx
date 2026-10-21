import { useEffect, useState } from 'react'
import './App.css'

type ConnectionStatus = 'checking' | 'available' | 'unavailable'

function App() {
  const [status, setStatus] = useState<ConnectionStatus>('checking')

  useEffect(() => {
    const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api'

    fetch(`${apiUrl}/health`)
      .then((response) => {
        if (!response.ok) throw new Error('Health check failed')
        return response.json()
      })
      .then((data: { status?: string }) => {
        setStatus(data.status === 'ok' ? 'available' : 'unavailable')
      })
      .catch(() => setStatus('unavailable'))
  }, [])

  const statusLabel = {
    checking: 'Verificando conexão…',
    available: 'Backend disponível',
    unavailable: 'Backend indisponível',
  }[status]

  return (
    <main>
      <p className="eyebrow">Uma nova forma de enviar carinho</p>
      <h1>Cartopia</h1>
      <p className="slogan">Cada mensagem, uma aventura.</p>
      <p className={`status ${status}`} role="status">{statusLabel}</p>
    </main>
  )
}

export default App
