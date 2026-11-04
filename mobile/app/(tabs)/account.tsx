import { colors } from '../../src/theme'
import { Link, useRouter } from 'expo-router'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useSession } from '../../src/context/SessionContext'

export default function AccountScreen() {
  const router = useRouter()
  const { session, loading, sessionExpired, signOut } = useSession()

  async function exit() {
    await signOut()
    router.replace('/')
  }

  const firstName = session?.user.name.trim().split(/\s+/)[0] || 'por aqui'

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.eyebrow}>CARTOPIA</Text>
        <Text style={styles.title}>Conta</Text>

        {loading ? (
          <View style={styles.card}>
            <ActivityIndicator color="#7c3aed" />
            <Text style={styles.body}>Abrindo sua conta…</Text>
          </View>
        ) : !session ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              {sessionExpired ? 'Sua sessão terminou' : 'Sua aventura também pode ser sem conta'}
            </Text>
            <Text style={styles.body}>
              {sessionExpired
                ? 'Entre novamente para acessar suas mensagens e viagens.'
                : 'Entre para encontrar as mensagens enviadas ao seu e-mail e acompanhar seus envios em outros aparelhos.'}
            </Text>
            <Link href="/auth" asChild>
              <Pressable accessibilityRole="button" style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>
                  {sessionExpired ? 'Entrar novamente' : 'Entrar ou criar conta'}
                </Text>
              </Pressable>
            </Link>
          </View>
        ) : (
          <>
            <View style={styles.profileCard}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {firstName.charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text style={styles.greeting}>{session.user.name}</Text>
              <Text style={styles.email}>{session.user.email}</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Mensagens e viagens</Text>
              <Text style={styles.body}>
                A aba Viagens reúne as mensagens enviadas para este e-mail
                e os envios associados à sua conta.
              </Text>
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={() => void exit()}
              style={styles.signOutButton}
            >
              <Text style={styles.signOutText}>Sair da conta</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  container: {
    backgroundColor: colors.background,
    flexGrow: 1,
    padding: 24,
    paddingBottom: 32,
  },
  eyebrow: {
    color: colors.primary,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 10,
  },
  title: {
    color: colors.ink,
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 24,
  },
  profileCard: {
    alignItems: 'center',
    backgroundColor: '#f0eafa',
    borderRadius: 20,
    marginBottom: 18,
    padding: 24,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 18,
    height: 62,
    justifyContent: 'center',
    marginBottom: 14,
    width: 62,
  },
  avatarText: { color: '#ffffff', fontSize: 27, fontWeight: '800' },
  greeting: { color: colors.ink, fontSize: 23, fontWeight: '800' },
  email: {
    color: colors.muted,
    fontSize: 15,
    marginTop: 6,
    textAlign: 'center',
  },
  card: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    padding: 22,
  },
  cardTitle: {
    color: colors.ink,
    fontSize: 19,
    fontWeight: '800',
    textAlign: 'center',
  },
  body: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 10,
    textAlign: 'center',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 12,
    justifyContent: 'center',
    marginTop: 20,
    minHeight: 48,
    paddingHorizontal: 18,
  },
  primaryButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '800' },
  signOutButton: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 28,
    minHeight: 48,
  },
  signOutText: { color: colors.primary, fontSize: 15, fontWeight: '700' },
})
