import { useState } from 'react'
import { Link, useRouter } from 'expo-router'
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ApiError } from '../src/api'
import { useSession } from '../src/context/SessionContext'

export default function AuthScreen() {
  const router = useRouter()
  const { signIn, signUp } = useSession()
  const [registering, setRegistering] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit() {
    setSubmitting(true)
    setError('')
    try {
      if (registering) {
        await signUp(name.trim(), email.trim(), password)
      } else {
        await signIn(email.trim(), password)
      }
      router.replace({ pathname: '/journeys', params: { section: 'incoming' } })
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Não foi possível entrar agora.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Link href="/" style={styles.back}>← Voltar</Link>
        <Text style={styles.title}>
          {registering ? 'Criar conta no Cartopia' : 'Entrar no Cartopia'}
        </Text>
        <Text style={styles.body}>
          Você também pode acompanhar uma entrega sem criar conta.
        </Text>
        {registering ? (
          <TextInput
            placeholder="Nome"
            value={name}
            onChangeText={setName}
            style={styles.input}
          />
        ) : null}
        <TextInput
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="E-mail"
          value={email}
          onChangeText={setEmail}
          style={styles.input}
        />
        <TextInput
          placeholder="Senha"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          style={styles.input}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable
          disabled={submitting}
          onPress={() => void submit()}
          style={styles.button}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>
              {registering ? 'Criar conta' : 'Entrar'}
            </Text>
          )}
        </Pressable>
        <Pressable
          onPress={() => {
            setRegistering((current) => !current)
            setError('')
          }}
          style={styles.switchButton}
        >
          <Text style={styles.switchText}>
            {registering ? 'Já tenho uma conta' : 'Quero criar uma conta'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: '#fffaf4', flex: 1 },
  container: { flex: 1, padding: 28, backgroundColor: '#fffaf4' },
  back: { color: '#7c3aed', fontSize: 16, marginBottom: 48 },
  title: { color: '#241b35', fontSize: 32, fontWeight: '800', marginBottom: 12 },
  body: { color: '#665d70', fontSize: 16, lineHeight: 24, marginBottom: 28 },
  input: { backgroundColor: '#ffffff', borderColor: '#e5dcef', borderRadius: 12, borderWidth: 1, fontSize: 16, marginBottom: 12, padding: 16 },
  error: { color: '#b42318', marginBottom: 12 },
  button: { alignItems: 'center', backgroundColor: '#7c3aed', borderRadius: 12, marginTop: 8, padding: 16 },
  buttonText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  switchButton: { alignItems: 'center', padding: 16 },
  switchText: { color: '#7c3aed', fontSize: 16, fontWeight: '700' },
})
