import { Image, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native'
import { colors } from '../theme'

type Props = {
  origin: string
  destination: string
  progress: number
  courierImage: ImageSourcePropType | undefined
}

function clampProgress(progress: number) {
  return Math.max(0, Math.min(100, Number.isFinite(progress) ? progress : 0))
}

export function PlayfulJourney({ origin, destination, progress, courierImage }: Props) {
  const percentage = clampProgress(progress)

  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>JORNADA LÚDICA</Text>
      <Text style={styles.title}>Uma trilha feita de imaginação.</Text>
      <View
        accessibilityLabel={`${percentage}% da jornada lúdica concluída`}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: percentage }}
        style={styles.track}
      >
        <View style={[styles.fill, { width: `${percentage}%` }]} />
        <View style={styles.startNode} />
        <View style={styles.endNode} />
        <View style={[styles.courierNode, { left: `${percentage}%` }]}>
          {courierImage ? <Image accessible={false} source={courierImage} style={styles.courierImage} /> : <Text style={styles.courierFallback}>✉</Text>}
        </View>
      </View>
      <View style={styles.labels}>
        <View style={styles.labelBlock}>
          <Text style={styles.labelCaption}>PARTIDA</Text>
          <Text numberOfLines={2} style={styles.label}>{origin}</Text>
        </View>
        <Text style={styles.progress}>{percentage}%</Text>
        <View style={[styles.labelBlock, styles.destinationBlock]}>
          <Text style={styles.labelCaption}>CHEGADA</Text>
          <Text numberOfLines={2} style={styles.label}>{destination}</Text>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fffdfb',
    borderColor: '#e5dcef',
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 16,
    padding: 20,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  title: {
    color: colors.ink,
    fontSize: 19,
    fontWeight: '800',
    marginTop: 8,
  },
  track: {
    backgroundColor: '#d7c6f1',
    borderRadius: 99,
    height: 6,
    marginHorizontal: 8,
    marginTop: 34,
    position: 'relative',
  },
  fill: {
    backgroundColor: colors.primary,
    borderRadius: 99,
    height: '100%',
  },
  startNode: {
    backgroundColor: colors.primary,
    borderColor: '#fffdfb',
    borderRadius: 8,
    borderWidth: 2,
    height: 14,
    left: -5,
    position: 'absolute',
    top: -4,
    width: 14,
  },
  endNode: {
    backgroundColor: '#e39b24',
    borderColor: '#fffdfb',
    borderRadius: 8,
    borderWidth: 2,
    height: 14,
    position: 'absolute',
    right: -5,
    top: -4,
    width: 14,
  },
  courierNode: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: colors.primary,
    borderRadius: 22,
    borderWidth: 2,
    height: 44,
    justifyContent: 'center',
    marginLeft: -22,
    position: 'absolute',
    top: -19,
    width: 44,
  },
  courierImage: {
    borderRadius: 16,
    height: 32,
    width: 32,
  },
  courierFallback: {
    color: colors.primary,
    fontSize: 20,
  },
  labels: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  labelBlock: {
    flex: 1,
  },
  destinationBlock: {
    alignItems: 'flex-end',
  },
  labelCaption: {
    color: '#8a8193',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  label: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 19,
    marginTop: 4,
    maxWidth: 130,
  },
  progress: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '800',
    marginHorizontal: 10,
    marginTop: 10,
  },
})
