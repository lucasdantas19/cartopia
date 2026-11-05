interface HangmanLockProps {
  wrongCount: number
  maxAttempts?: number
}

export function HangmanLock({ wrongCount, maxAttempts = 6 }: HangmanLockProps) {
  const visibleParts = Math.min(maxAttempts, Math.max(0, wrongCount))

  return (
    <div className="hangman-lock" role="img" aria-label={`${visibleParts} de ${maxAttempts} partes do cadeado reveladas`}>
      <svg viewBox="0 0 160 150" aria-hidden="true">
        <path className={visibleParts >= 1 ? 'visible' : ''} d="M48 68V49c0-18 14-32 32-32" />
        <path className={visibleParts >= 2 ? 'visible' : ''} d="M80 17c18 0 32 14 32 32v19" />
        <path className={visibleParts >= 3 ? 'visible' : ''} d="M42 68h76" />
        <path className={visibleParts >= 4 ? 'visible' : ''} d="M42 68v56" />
        <path className={visibleParts >= 5 ? 'visible' : ''} d="M118 68v56" />
        <path className={visibleParts >= 6 ? 'visible' : ''} d="M42 124h76M80 88v18M72 88h16" />
      </svg>
    </div>
  )
}
