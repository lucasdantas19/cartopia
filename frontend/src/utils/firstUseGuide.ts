export const firstUseGuideStorageKey = 'cartopia:first-use-guide:dismissed'

export function shouldShowFirstUseGuide(value: string | null): boolean {
  return value !== 'true'
}
