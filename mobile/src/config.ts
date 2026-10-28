const fallbackApiUrl = 'http://localhost:8000/api/v1'

export const apiUrl = (process.env.EXPO_PUBLIC_API_URL ?? fallbackApiUrl).replace(/\/$/, '')
