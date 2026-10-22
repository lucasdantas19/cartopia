import type { CourierCode } from './types'

export interface CourierOption {
  code: CourierCode
  label: string
  description: string
  cardAsset: string
  iconAsset: string
}

export const couriers: CourierOption[] = [
  { code: 'paper-swallow', label: 'Andorinha de Papel', description: 'Leve e veloz, desliza pelo caminho.', cardAsset: '/couriers/paper-swallow-card.png', iconAsset: '/couriers/paper-swallow-icon.png' },
  { code: 'postal-cat', label: 'Gatinho Carteiro', description: 'Cuidadoso, curioso e cheio de charme.', cardAsset: '/couriers/postal-cat-card.png', iconAsset: '/couriers/postal-cat-icon.png' },
  { code: 'little-dragon', label: 'Dragão Mensageiro', description: 'Corajoso, caloroso e pronto para voar.', cardAsset: '/couriers/little-dragon-card.png', iconAsset: '/couriers/little-dragon-icon.png' },
]

export function getCourier(code: string): CourierOption {
  return couriers.find((courier) => courier.code === code) ?? couriers[0]
}
