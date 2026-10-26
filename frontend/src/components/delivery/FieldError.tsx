interface FieldErrorProps {
  messages: string[]
}

export function FieldError({ messages }: FieldErrorProps) {
  return <p className="field-error" role="alert">{messages[0]}</p>
}
