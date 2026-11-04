export const accountSections = [
  { id: 'overview', path: '/conta', label: 'Visão geral', description: 'O que está acontecendo no seu correio.' },
  { id: 'letters', path: '/conta/cartas', label: 'Caixa de cartas', description: 'Abra novas mensagens e reencontre suas lembranças.' },
  { id: 'sent', path: '/conta/envios', label: 'Meus envios', description: 'Veja as viagens em andamento e seu histórico.' },
  { id: 'tracked', path: '/conta/acompanhamentos', label: 'Acompanhamentos', description: 'Guarde links de entregas para encontrá-los novamente.' },
  { id: 'addressBook', path: '/conta/agenda', label: 'Agenda', description: 'Seus lugares e pessoas especiais, prontos para a próxima carta.' },
  { id: 'profile', path: '/conta/perfil', label: 'Perfil', description: 'Confira os dados da sua conta.' },
] as const

export type AccountSection = typeof accountSections[number]['id']

export function accountSectionFromPath(path: string): AccountSection | null {
  return accountSections.find((section) => section.path === path.replace(/\/$/, ''))?.id ?? null
}
