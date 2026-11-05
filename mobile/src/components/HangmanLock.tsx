import { StyleSheet, View } from 'react-native'

type Props = { wrongCount: number; maxAttempts?: number }

export function HangmanLock({ wrongCount, maxAttempts = 6 }: Props) {
  const visible = Math.min(maxAttempts, Math.max(0, wrongCount))
  const part = (index: number, shape: keyof typeof styles) => [styles.lockPart, styles[shape], visible >= index ? styles.lockPartVisible : undefined]

  return (
    <View accessibilityLabel={`${visible} de ${maxAttempts} partes do cadeado reveladas`} accessibilityRole="image" style={styles.lock}>
      <View style={part(1, 'shackleLeft')} />
      <View style={part(2, 'shackleRight')} />
      <View style={part(3, 'bodyTop')} />
      <View style={part(4, 'bodyLeft')} />
      <View style={part(5, 'bodyRight')} />
      <View style={part(6, 'bodyBottom')} />
    </View>
  )
}

const styles = StyleSheet.create({
  lock: { height: 82, marginTop: 12, position: 'relative', width: 94 },
  lockPart: { borderColor: '#c8b9dc', opacity: 0.22, position: 'absolute' },
  lockPartVisible: { borderColor: '#7668b5', opacity: 1 },
  shackleLeft: { borderLeftWidth: 4, borderRadius: 24, borderTopWidth: 4, height: 30, left: 25, top: 2, width: 22 },
  shackleRight: { borderRadius: 24, borderRightWidth: 4, borderTopWidth: 4, height: 30, left: 47, top: 2, width: 22 },
  bodyTop: { backgroundColor: '#c8b9dc', height: 4, left: 21, top: 29, width: 52 },
  bodyLeft: { backgroundColor: '#c8b9dc', height: 36, left: 21, top: 29, width: 4 },
  bodyRight: { backgroundColor: '#c8b9dc', height: 36, left: 69, top: 29, width: 4 },
  bodyBottom: { backgroundColor: '#c8b9dc', height: 4, left: 21, top: 61, width: 52 },
})
