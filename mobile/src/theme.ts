import { Platform } from 'react-native'

// Same core palette as frontend/src/index.css.
export const colors = {
  ink: '#203844',
  muted: '#6b7184',
  background: '#f8f6fc',
  sand: '#e9e4f2',
  line: '#ddd6e9',
  primary: '#7668b5',
  surface: '#ffffff',
}

export const displayFont = Platform.select({ ios: 'Georgia', android: 'serif', web: 'Georgia' })
