export type LocationCode = 'port-of-dreams' | 'garden-of-ideas' | 'library-of-memories'
export type Coordinates = [longitude: number, latitude: number]

export interface DeliveryLocation {
  code: LocationCode
  label: string
  coordinates: Coordinates
}

export const locations: readonly DeliveryLocation[] = [
  { code: 'port-of-dreams', label: 'Porto dos Sonhos', coordinates: [-34.877, -8.063] },
  { code: 'garden-of-ideas', label: 'Jardim das Ideias', coordinates: [-34.912, -8.047] },
  { code: 'library-of-memories', label: 'Biblioteca das Memórias', coordinates: [-34.900, -8.055] },
]

export function getLocation(code: string): DeliveryLocation | undefined {
  return locations.find((location) => location.code === code)
}
