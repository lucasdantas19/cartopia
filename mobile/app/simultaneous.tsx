import { colors } from '../src/theme'
import { useCallback, useState } from 'react'
import { Link, useFocusEffect } from 'expo-router'
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ApiError, fetchActiveMapDeliveries } from '../src/api'
import { SimultaneousDeliveryMap, deliveryColors } from '../src/components/SimultaneousDeliveryMap'
import { useSession } from '../src/context/SessionContext'
import type { ActiveMapDelivery } from '../src/domain'
import { deliveryMapRoute } from '../src/trackingMap'

export default function SimultaneousScreen() {
  const { session, loading: sessionLoading } = useSession()
  const [deliveries, setDeliveries] = useState<ActiveMapDelivery[]>([])
  const [fetchedAt, setFetchedAt] = useState(Date.now())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!session) return
    setError('')
    try {
      const response = await fetchActiveMapDeliveries(session.token)
      setDeliveries(response.data)
      setFetchedAt(Date.now())
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Não foi possível carregar as entregas.')
    } finally {
      setLoading(false)
    }
  }, [session?.token])

  useFocusEffect(useCallback(() => {
    if (!session) {
      setDeliveries([])
      return
    }
    setLoading(true)
    void load()
    const interval = setInterval(() => void load(), 30000)
    return () => clearInterval(interval)
  }, [session?.token, load]))

  const mapped = deliveries.filter((delivery) => deliveryMapRoute(delivery) !== null)

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Link href="/(tabs)/journeys" style={styles.back}>← Voltar às viagens</Link>
        <Text style={styles.title}>Viagens no mapa</Text>
        <Text style={styles.description}>
          Até cinco entregas recentes em andamento. As posições são estimadas pelo tempo de viagem.
        </Text>
        {sessionLoading || (session && loading) ? <ActivityIndicator color="#7c3aed" /> : null}
        {!sessionLoading && !session ? (
          <View style={styles.notice}>
            <Text>Entre na sua conta para acompanhar suas entregas juntas.</Text>
            <Link href="/auth" style={styles.back}>Entrar</Link>
          </View>
        ) : null}
        {session && error ? (
          <View style={styles.notice}>
            <Text accessibilityRole="alert">{error}</Text>
            <Pressable onPress={() => void load()} accessibilityRole="button">
              <Text style={styles.back}>Tentar novamente</Text>
            </Pressable>
          </View>
        ) : null}
        {session && !loading && !error && deliveries.length === 0 ? (
          <Text style={styles.notice}>Nenhuma entrega em andamento na sua conta.</Text>
        ) : null}
        {session && !loading && !error && mapped.length === 0 && deliveries.length > 0 ? (
          <Text style={styles.notice}>Estas entregas não têm coordenadas para aparecer no mapa.</Text>
        ) : null}
        {session && Platform.OS === 'web' && mapped.length > 0 ? (
          <Text style={styles.notice}>O mapa simultâneo está disponível no aplicativo para celular.</Text>
        ) : null}
        {session && mapped.length > 0 && Platform.OS !== 'web' ? (
          <SimultaneousDeliveryMap
            deliveries={deliveries}
            fetchedAt={fetchedAt}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        ) : null}
        {session && !loading && deliveries.map((delivery, index) => (
          <Pressable
            key={delivery.public_id}
            accessibilityRole="button"
            accessibilityState={{
              disabled: !deliveryMapRoute(delivery),
              selected: selectedId === delivery.public_id,
            }}
            disabled={!deliveryMapRoute(delivery) || Platform.OS === 'web'}
            onPress={() => setSelectedId(delivery.public_id)}
            style={[styles.row, selectedId === delivery.public_id && styles.selectedRow]}
          >
            <View style={[styles.dot, { backgroundColor: deliveryColors[index] }]} />
            <View style={styles.rowText}>
              <Text style={styles.name}>Para {delivery.recipient_name}</Text>
              <Text style={styles.route}>{delivery.origin} → {delivery.destination}</Text>
              {!deliveryMapRoute(delivery) ? (
                <Text style={styles.unmapped}>Sem coordenadas para o mapa</Text>
              ) : null}
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { padding: 24, gap: 16 },
  back: { color: colors.primary, fontWeight: '800', fontSize: 15 },
  title: { color: colors.ink, fontWeight: '800', fontSize: 30 },
  description: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  notice: { backgroundColor: '#fff', borderRadius: 14, padding: 16, color: colors.muted },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', padding: 14, borderRadius: 14 },
  selectedRow: { backgroundColor: '#f0eafa' },
  dot: { width: 18, height: 18, borderRadius: 9 },
  rowText: { flex: 1 },
  name: { fontSize: 16, fontWeight: '800', color: colors.ink },
  route: { color: colors.muted, marginTop: 4 },
  unmapped: { color: '#b42318', marginTop: 4 },
})
