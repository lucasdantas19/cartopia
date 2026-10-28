import { Link } from 'expo-router'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSession } from '../src/context/SessionContext'

export default function HomeScreen() {
  const { session, loading } = useSession()

  if (loading) return <ActivityIndicator style={styles.centered} color="#7c3aed" />

  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>CARTOPIA</Text>
      <Text style={styles.title}>Toda mensagem pode virar uma aventura.</Text>
      <Text style={styles.body}>
        Acompanhe entregas por um link ou entre na sua conta para ver seu histórico.
      </Text>
      <Link href="/create" asChild>
        <Pressable style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Criar uma entrega</Text>
        </Pressable>
      </Link>
      <Link href="/track" asChild>
        <Pressable style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Acompanhar uma entrega</Text>
        </Pressable>
      </Link>
      <Link href={session ? '/account' : '/auth'} asChild>
        <Pressable style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>{session ? 'Abrir minha conta' : 'Entrar ou criar conta'}</Text>
        </Pressable>
      </Link>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 28, backgroundColor: '#fffaf4' },
  centered: { flex: 1 },
  eyebrow: { color: '#7c3aed', fontWeight: '800', letterSpacing: 2, marginBottom: 14 },
  title: { color: '#241b35', fontSize: 38, fontWeight: '800', lineHeight: 44, marginBottom: 18 },
  body: { color: '#665d70', fontSize: 17, lineHeight: 25, marginBottom: 34 },
  primaryButton: { alignItems: 'center', backgroundColor: '#7c3aed', borderRadius: 14, padding: 16 },
  primaryButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  secondaryButton: { alignItems: 'center', borderColor: '#e5dcef', borderRadius: 14, borderWidth: 1, marginTop: 10, padding: 16 },
  secondaryButtonText: { color: '#7c3aed', fontSize: 16, fontWeight: '700' },
})
