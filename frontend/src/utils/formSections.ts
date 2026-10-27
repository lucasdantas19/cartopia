export type FormSection = 'message' | 'courier' | 'adventure'
export type FormSectionState = Record<FormSection, boolean>

export function toggleFormSection(state: FormSectionState, section: FormSection): FormSectionState {
  return { ...state, [section]: !state[section] }
}
