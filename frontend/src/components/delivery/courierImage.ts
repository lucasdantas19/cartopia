import type { SyntheticEvent } from 'react'

export function handleCourierImageError(event: SyntheticEvent<HTMLImageElement>) {
  const image = event.currentTarget
  image.onerror = null
  image.src = '/couriers/paper-swallow.svg'
}
