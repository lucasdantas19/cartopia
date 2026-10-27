interface FieldErrorProps {
  messages: string[]
  id?: string
}

export function FieldError({ messages, id }: FieldErrorProps) {
  return <p id={id} className="field-error" role="alert">{messages[0]}</p>
}
