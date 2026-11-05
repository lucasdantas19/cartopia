import type { ExpoConfig } from 'expo/config'

function webHost() {
  const value = process.env.EXPO_PUBLIC_WEB_URL?.trim()
  if (!value) return null

  try {
    const url = new URL(value)
    return url.protocol === 'https:' ? url.host : null
  } catch {
    return null
  }
}

export default ({ config }: { config: ExpoConfig }): ExpoConfig => {
  const host = webHost()

  return {
    ...config,
    ios: {
      ...config.ios,
      associatedDomains: host ? [`applinks:${host}`] : [],
    },
    android: {
      ...config.android,
      intentFilters: host ? [
        {
          action: 'VIEW',
          autoVerify: true,
          category: ['BROWSABLE', 'DEFAULT'],
          data: [{ scheme: 'https', host, pathPrefix: '/d' }],
        },
      ] : [],
    },
  }
}
