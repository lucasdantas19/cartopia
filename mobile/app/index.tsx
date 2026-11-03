import { useCallback, useState } from 'react'
import { Link, useFocusEffect, useRouter } from 'expo-router'
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSession } from '../src/context/SessionContext'
import {
  listRecentDeliveries,
  removeRecentDelivery,
  type RecentDelivery,
} from '../src/recentDeliveries'

export default function HomeScreen() {
  const router = useRouter()
  const { session, loading } = useSession()
  const [recent, setRecent] = useState<RecentDelivery[]>([])
  const [recentLoading, setRecentLoading] = useState(Platform.OS !== 'web')
  const [recentError, setRecentError] = useState('')

  const loadRecent = useCallback(async () => {
    if (Platform.OS === 'web') return

    setRecentLoading(true)
    setRecentError('')
    try {
      setRecent(await listRecentDeliveries())
    } catch {
      setRecentError('Não foi possível carregar as entregas salvas neste celular.')
    } finally {
      setRecentLoading(false)
    }
  }, [])

  useFocusEffect(useCallback(() => {
    void loadRecent()
  }, [loadRecent]))

  function openRecent(delivery: RecentDelivery) {
    router.push({
      pathname: '/track',
      params: { publicId: delivery.publicId, token: delivery.senderToken },
    })
  }

  function confirmRemoval(delivery: RecentDelivery) {
    Alert.alert(
      'Remover deste celular?',
      'O acesso salvo a esta entrega será apagado. Guarde seu link de remetente se quiser abri-la depois.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: () => {
            void removeRecentDelivery(delivery.publicId)
              .then(() => setRecent((items) => items.filter((item) => item.publicId !== delivery.publicId)))
              .catch(() => setRecentError('Não foi possível remover esta entrega do celular.'))
          },
        },
      ],
    )
  }

  if (loading) return <ActivityIndicator style={styles.centered} color="#7c3aed" />

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.eyebrow}>CARTOPIA</Text>
        <Text style={styles.title}>Toda mensagem pode virar uma aventura.</Text>
        <Text style={styles.body}>
          Crie uma surpresa ou acompanhe uma entrega pelo link que você recebeu.
        </Text>

        <Link href="/create" asChild>
          <Pressable accessibilityRole="button" style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Criar uma entrega</Text>
          </Pressable>
        </Link>
        <Link href="/track" asChild>
          <Pressable accessibilityRole="button" style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Acompanhar pelo link</Text>
          </Pressable>
        </Link>

        {Platform.OS !== 'web' ? (
          <View style={styles.recentSection}>
            <Text style={styles.sectionTitle}>Recentes neste celular</Text>
            <Text style={styles.sectionDescription}>
              As cinco últimas entregas criadas aqui ficam disponíveis mesmo após fechar o aplicativo.
            </Text>

            {recentLoading ? (
              <ActivityIndicator color="#7c3aed" style={styles.recentLoading} />
            ) : null}
            {recentError ? (
              <View style={styles.errorPanel}>
                <Text accessibilityRole="alert" style={styles.errorText}>{recentError}</Text>
                <Pressable accessibilityRole="button" onPress={() => void loadRecent()}>
                  <Text style={styles.retryText}>Tentar novamente</Text>
                </Pressable>
              </View>
            ) : null}
            {!recentLoading && !recentError && recent.length === 0 ? (
              <Text style={styles.emptyText}>As entregas que você criar aparecerão aqui.</Text>
            ) : null}

            {recent.map((delivery) => (
              <View key={delivery.publicId} style={styles.recentCard}>
                <Text style={styles.recentEyebrow}>CARTA PARA</Text>
                <Text numberOfLines={2} style={styles.recentName}>{delivery.recipientName}</Text>
                <Text numberOfLines={2} style={styles.recentRoute}>
                  {delivery.origin} → {delivery.destination}
                </Text>
                <View style={styles.recentActions}>
                  <Pressable
                    accessibilityLabel={`Acompanhar entrega para ${delivery.recipientName}`}
                    accessibilityRole="button"
                    onPress={() => openRecent(delivery)}
                    style={styles.openButton}
                  >
                    <Text style={styles.openButtonText}>Acompanhar</Text>
                  </Pressable>
                  <Pressable
                    accessibilityLabel={`Remover entrega para ${delivery.recipientName} deste celular`}
                    accessibilityRole="button"
                    onPress={() => confirmRemoval(delivery)}
                    style={styles.removeButton}
                  >
                    <Text style={styles.removeButtonText}>Remover</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        <Link href={session ? '/account' : '/auth'} asChild>
          <Pressable accessibilityRole="button" style={styles.accountButton}>
            <Text style={styles.accountButtonText}>
              {session ? 'Abrir minha conta' : 'Entrar ou criar conta'}
            </Text>
          </Pressable>
        </Link>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#fffaf4',
    flex: 1,
  },
  container: {
    backgroundColor: '#fffaf4',
    flexGrow: 1,
    padding: 24,
    paddingBottom: 44,
  },
  centered: {
    flex: 1,
  },
  eyebrow: {
    color: '#7c3aed',
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 14,
    marginTop: 12,
  },
  title: {
    color: '#241b35',
    fontSize: 34,
    fontWeight: '800',
    lineHeight: 40,
  },
  body: {
    color: '#665d70',
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 24,
    marginTop: 14,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#7c3aed',
    borderRadius: 14,
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    alignItems: 'center',
    borderColor: '#e5dcef',
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 50,
    marginTop: 10,
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    color: '#7c3aed',
    fontSize: 16,
    fontWeight: '700',
  },
  recentSection: {
    marginTop: 34,
  },
  sectionTitle: {
    color: '#241b35',
    fontSize: 22,
    fontWeight: '800',
  },
  sectionDescription: {
    color: '#665d70',
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 16,
    marginTop: 5,
  },
  recentLoading: {
    marginVertical: 18,
  },
  errorPanel: {
    backgroundColor: '#fff3d6',
    borderRadius: 14,
    padding: 16,
  },
  errorText: {
    color: '#b42318',
    fontSize: 14,
    lineHeight: 20,
  },
  retryText: {
    color: '#7c3aed',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 12,
  },
  emptyText: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    color: '#665d70',
    fontSize: 14,
    lineHeight: 21,
    padding: 16,
  },
  recentCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    marginBottom: 12,
    padding: 18,
  },
  recentEyebrow: {
    color: '#7c3aed',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  recentName: {
    color: '#241b35',
    fontSize: 20,
    fontWeight: '800',
    marginTop: 5,
  },
  recentRoute: {
    color: '#665d70',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 7,
  },
  recentActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 16,
    marginTop: 16,
  },
  openButton: {
    alignItems: 'center',
    backgroundColor: '#7c3aed',
    borderRadius: 10,
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
  },
  openButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  removeButton: {
    justifyContent: 'center',
    minHeight: 44,
  },
  removeButtonText: {
    color: '#8a8193',
    fontSize: 14,
    fontWeight: '700',
  },
  accountButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    marginTop: 14,
  },
  accountButtonText: {
    color: '#7c3aed',
    fontSize: 15,
    fontWeight: '700',
  },
})
