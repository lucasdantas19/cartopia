import type { CourierCode } from './types'

export interface CourierOption {
  code: CourierCode
  label: string
  description: string
  asset: string
}

export const couriers: CourierOption[] = [
  { code: 'paper-swallow', label: 'Andorinha de Papel', description: 'Leve e veloz, desliza pelo caminho.', asset: '/couriers/paper-swallow.svg' },
  { code: 'postal-cat', label: 'Gatinho Carteiro', description: 'Cuidadoso, curioso e cheio de charme.', asset: '/couriers/postal-cat.svg' },
  { code: 'little-dragon', label: 'Dragão Mensageiro', description: 'Corajoso, caloroso e pronto para voar.', asset: '/couriers/little-dragon.svg' },
]

export function getCourier(code: string): CourierOption {
  return couriers.find((courier) => courier.code === code) ?? couriers[0]
}
