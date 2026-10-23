export type FrontendEnvironment = {
  PROD?: boolean
  VITE_API_URL?: string
  VITE_REVERB_APP_KEY?: string
  VITE_REVERB_HOST?: string
  VITE_REVERB_PORT?: string
  VITE_REVERB_SCHEME?: string
  VITE_BROADCAST_AUTH_URL?: string
}

export class FrontendConfigurationError extends Error {
  constructor(variable: string, reason: string) {
    super(`Configuração de produção inválida: ${variable} ${reason}.`)
    this.name = 'FrontendConfigurationError'
  }
}

export function isProductionEnvironment(env: FrontendEnvironment): boolean {
  return env.PROD === true
}

export function validatePublicUrl(value: string | undefined, variable: string, production: boolean): string {
  const normalized = value?.trim()
  if (!normalized) throw new FrontendConfigurationError(variable, 'é obrigatória')

  let url: URL
  try {
    url = new URL(normalized)
  } catch {
    throw new FrontendConfigurationError(variable, 'deve ser uma URL válida')
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new FrontendConfigurationError(variable, 'deve usar HTTP ou HTTPS')
  }

  if (production && (url.protocol !== 'https:' || ['localhost', '127.0.0.1', '::1'].includes(url.hostname))) {
    throw new FrontendConfigurationError(variable, 'deve usar HTTPS e um host público')
  }

  return normalized.replace(/\/$/, '')
}

export function resolveApiBaseUrl(env: FrontendEnvironment): string {
  if (!isProductionEnvironment(env) && !env.VITE_API_URL) return 'http://localhost:8000/api'

  return validatePublicUrl(env.VITE_API_URL, 'VITE_API_URL', isProductionEnvironment(env))
}
