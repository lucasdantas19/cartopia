const fallbackApiUrl = 'http://localhost:8000/api/v1'

export const apiUrl = (process.env.EXPO_PUBLIC_API_URL ?? fallbackApiUrl).replace(/\/$/, '')

export const webUrl = process.env.EXPO_PUBLIC_WEB_URL?.replace(/\/$/, '') ?? ''

export const mapboxAccessToken = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim() ?? ''
