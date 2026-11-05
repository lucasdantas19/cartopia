export interface PasswordRequirement {
  key: 'length' | 'lowercase' | 'uppercase' | 'number'
  label: string
  valid: boolean
}

export function passwordRequirements(password: string): PasswordRequirement[] {
  return [
    { key: 'length', label: 'Pelo menos 8 caracteres', valid: password.length >= 8 },
    { key: 'lowercase', label: 'Uma letra minúscula', valid: /[a-z]/.test(password) },
    { key: 'uppercase', label: 'Uma letra maiúscula', valid: /[A-Z]/.test(password) },
    { key: 'number', label: 'Um número', valid: /[0-9]/.test(password) },
  ]
}

export function isPasswordStrongEnough(password: string): boolean {
  return passwordRequirements(password).every((requirement) => requirement.valid)
}
