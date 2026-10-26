export function progressMarkerTransform(progress: number): string {
  if (progress <= 0) return 'translateX(0)'
  if (progress >= 100) return 'translateX(-100%)'

  return 'translateX(-50%)'
}
