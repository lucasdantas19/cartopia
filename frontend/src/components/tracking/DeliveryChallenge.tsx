import { useState } from 'react'
import { HangmanLock } from './HangmanLock'

interface DeliveryChallengeProps {
  attemptsRemaining: number
  error: string
  submitting: boolean
  onSubmit: (answer: string) => void
  type: 'password' | 'hangman'
  pattern?: string
  guessedLetters?: string[]
  wrongLetters?: string[]
}

export function DeliveryChallenge({ attemptsRemaining, error, submitting, onSubmit, type, pattern, guessedLetters = [], wrongLetters = [] }: DeliveryChallengeProps) {
  const [answer, setAnswer] = useState('')

  return (
    <section className="delivery-challenge" aria-labelledby="delivery-challenge-title">
      <p className="eyebrow">Desafio da carta</p>
      <h2 id="delivery-challenge-title">{type === 'hangman' ? 'Descubra a palavra' : 'Qual é a senha?'}</h2>
      <p>{type === 'hangman' ? 'Escolha uma letra por vez para revelar a palavra secreta.' : 'Peça ao remetente a senha para abrir esta mensagem.'}</p>
      {type === 'hangman' && pattern ? <strong className="hangman-pattern" aria-label="Palavra parcialmente revelada">{pattern}</strong> : null}
      {type === 'hangman' ? <HangmanLock wrongCount={wrongLetters.length} /> : null}
      {type === 'hangman' && guessedLetters.length > 0 ? <div className="hangman-attempts" aria-label="Letras tentadas"><small>Letras tentadas</small><div>{guessedLetters.map((letter) => <span className={wrongLetters.includes(letter) ? 'wrong' : 'correct'} key={letter}>{letter}</span>)}</div></div> : null}
      <form onSubmit={(event) => { event.preventDefault(); onSubmit(answer) }}>
        <label htmlFor="delivery-challenge-answer">{type === 'hangman' ? 'Letra' : 'Senha'}</label>
        <input id="delivery-challenge-answer" autoComplete="off" maxLength={type === 'hangman' ? 1 : 120} type={type === 'hangman' ? 'text' : 'password'} value={answer} onChange={(event) => setAnswer(event.target.value)} disabled={submitting || attemptsRemaining === 0} />
        <button className="button primary" type="submit" disabled={submitting || !answer.trim() || attemptsRemaining === 0}>{submitting ? 'Verificando…' : 'Desbloquear carta'}</button>
      </form>
      <small>{attemptsRemaining > 0 ? `${attemptsRemaining} tentativa(s) restante(s).` : 'Limite de tentativas atingido.'}</small>
      {error ? <p className="field-error" role="alert">{error}</p> : null}
    </section>
  )
}
