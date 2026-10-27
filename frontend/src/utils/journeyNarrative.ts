import type { DeliveryStatus, DeliveryStep } from '../domain/delivery/types'

interface JourneyNarrativeInput {
  origin: string
  destination: string
  status: DeliveryStatus
  steps: DeliveryStep[]
  currentStep: number | null
  hiddenSteps?: number
}

function joinStops(stops: string[]): string {
  if (stops.length <= 1) return stops[0] ?? ''
  if (stops.length === 2) return `${stops[0]} e ${stops[1]}`
  return `${stops.slice(0, -1).join(', ')} e ${stops.at(-1)}`
}

export function buildJourneyNarrative({ origin, destination, status, steps, currentStep, hiddenSteps = 0 }: JourneyNarrativeInput): string {
  if (!steps.length) {
    if (status === 'DELIVERED') return `A mensagem partiu de ${origin} e chegou ao seu destino: ${destination}.`
    if (status === 'IN_TRANSIT') return `A mensagem deixou ${origin} e está a caminho de ${destination}.`
    return `A mensagem está pronta para partir de ${origin} rumo a ${destination}.`
  }

  const stopLabels = steps.map((step) => step.location?.label || step.title)
  if (status === 'DELIVERED') return `A mensagem partiu de ${origin}, passou por ${joinStops(stopLabels)} e chegou a ${destination}.`

  const current = currentStep !== null && steps[currentStep]
  if (current) return `A mensagem partiu de ${origin} e agora vive este capítulo: ${current.title}. Depois, seguirá para ${destination}${hiddenSteps ? `, com ${hiddenSteps} surpresa${hiddenSteps === 1 ? '' : 's'} ainda pelo caminho` : ''}.`
  if (hiddenSteps) return `A mensagem partirá de ${origin}, fará uma pausa pelo caminho e seguirá até ${destination}. As próximas etapas serão reveladas durante a viagem.`
  return `A mensagem partirá de ${origin}, fará uma pausa em ${joinStops(stopLabels)} e seguirá até ${destination}.`
}
