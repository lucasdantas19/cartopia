export type LocationCode = 'port-of-dreams' | 'garden-of-ideas' | 'library-of-memories' | 'paris' | 'disney'
export type Coordinates = [longitude: number, latitude: number]

export interface DeliveryLocation {
  code: LocationCode
  label: string
  description: string
  coordinates: Coordinates
}

export const locations: readonly DeliveryLocation[] = [
  { code: 'port-of-dreams', label: 'Porto dos Sonhos', description: 'Onde cada viagem começa com uma ideia.', coordinates: [-34.877, -8.063] },
  { code: 'garden-of-ideas', label: 'Jardim das Ideias', description: 'Um jardim colorido para mensagens florescerem.', coordinates: [-34.912, -8.047] },
  { code: 'library-of-memories', label: 'Biblioteca das Memórias', description: 'Estantes silenciosas guardam histórias queridas.', coordinates: [-34.900, -8.055] },
  { code: 'paris', label: 'Paris', description: 'Uma escala charmosa entre cartas e sonhos.', coordinates: [2.3522, 48.8566] },
  { code: 'disney', label: 'Disney', description: 'Onde toda parada ganha um pouco de magia.', coordinates: [-81.5639, 28.3852] },
]

export function getLocation(code: string): DeliveryLocation | undefined {
  return locations.find((location) => location.code === code)
}
