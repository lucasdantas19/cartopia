import { StyleSheet, View, type ColorValue } from 'react-native'

type Props = { name: 'home' | 'letter' | 'account'; color: ColorValue }

export function TabIcon({ name, color }: Props) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.frame}
    >
      {name === 'home' ? (
        <>
          <View style={[styles.house, { borderColor: color }]} />
          <View style={[styles.roof, { borderColor: color }]} />
          <View style={[styles.door, { borderColor: color }]} />
        </>
      ) : name === 'letter' ? (
        <>
          <View style={[styles.envelope, { borderColor: color }]} />
          <View style={[styles.flap, { borderColor: color }]} />
        </>
      ) : (
        <>
          <View style={[styles.head, { borderColor: color }]} />
          <View style={[styles.shoulders, { borderColor: color }]} />
        </>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  frame: { width: 24, height: 24 },
  house: { position: 'absolute', left: 5, top: 10, width: 14, height: 12, borderWidth: 2, borderTopWidth: 0, borderRadius: 2 },
  roof: { position: 'absolute', left: 5, top: 4, width: 14, height: 14, borderTopWidth: 2, borderLeftWidth: 2, transform: [{ rotate: '45deg' }] },
  door: { position: 'absolute', left: 10, top: 15, width: 5, height: 7, borderWidth: 2, borderBottomWidth: 0 },
  envelope: { position: 'absolute', left: 1, top: 5, width: 22, height: 16, borderWidth: 2, borderRadius: 3 },
  flap: { position: 'absolute', left: 6, top: 2, width: 12, height: 12, borderBottomWidth: 2, borderRightWidth: 2, transform: [{ rotate: '45deg' }] },
  head: { position: 'absolute', left: 8, top: 1, width: 9, height: 9, borderWidth: 2, borderRadius: 5 },
  shoulders: { position: 'absolute', left: 3, top: 13, width: 19, height: 10, borderWidth: 2, borderTopLeftRadius: 10, borderTopRightRadius: 10 },
})
