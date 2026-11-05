import { colors } from '../src/theme'
import { useState } from 'react'
import { Link, useRouter } from 'expo-router'
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
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
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; email?: string; password?: string }>({})
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function submit() {
    const nextErrors: typeof fieldErrors = {}
    if (registering && !name.trim()) nextErrors.name = 'Informe seu nome.'
    if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email.trim())) nextErrors.email = 'Informe um e-mail válido.'
    if (!password) nextErrors.password = 'Informe sua senha.'
    else if (registering && (password.length < 8 || password.length > 72)) nextErrors.password = 'A senha deve ter entre 8 e 72 caracteres.'
    if (Object.keys(nextErrors).length) {
      setFieldErrors(nextErrors)
      setError('Revise os campos indicados.')
      return
    }

    setSubmitting(true)
    setError('')
    setFieldErrors({})
    try {
      if (registering) {
        await signUp(name.trim(), email.trim(), password)
      } else {
        await signIn(email.trim(), password)
      }
      router.replace({ pathname: '/journeys', params: { section: 'incoming' } })
    } catch (caught) {
      if (caught instanceof ApiError && caught.errors) {
        setFieldErrors({
          name: caught.errors.name?.[0],
          email: caught.errors.email?.[0],
          password: caught.errors.password?.[0],
        })
      }
      setError(caught instanceof ApiError ? caught.message : 'Não foi possível entrar agora.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboardView}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Link href="/" style={styles.back}>← Voltar</Link>
        <Text style={styles.title}>
          {registering ? 'Criar conta no Cartopia' : 'Entrar no Cartopia'}
        </Text>
        <Text style={styles.body}>
          Você também pode acompanhar uma entrega sem criar conta.
        </Text>
        {registering ? (
          <View>
            <Text style={styles.label}>Nome</Text>
            <TextInput accessibilityLabel="Nome" autoComplete="name" placeholder="Como podemos chamar você?" value={name} onChangeText={(value) => { setName(value); setFieldErrors((current) => ({ ...current, name: undefined })) }} style={styles.input} />
            {fieldErrors.name ? <Text style={styles.fieldError}>{fieldErrors.name}</Text> : null}
          </View>
        ) : null}
        <Text style={styles.label}>E-mail</Text>
        <TextInput accessibilityLabel="E-mail" autoCapitalize="none" autoComplete="email" keyboardType="email-address" placeholder="nome@exemplo.com" returnKeyType="next" value={email} onChangeText={(value) => { setEmail(value); setFieldErrors((current) => ({ ...current, email: undefined })) }} style={styles.input} />
        {fieldErrors.email ? <Text style={styles.fieldError}>{fieldErrors.email}</Text> : null}
        <Text style={styles.label}>Senha</Text>
        <View style={styles.passwordRow}>
          <TextInput accessibilityLabel="Senha" autoComplete={registering ? 'new-password' : 'current-password'} placeholder="Sua senha" returnKeyType="done" secureTextEntry={!showPassword} value={password} onChangeText={(value) => { setPassword(value); setFieldErrors((current) => ({ ...current, password: undefined })) }} style={styles.passwordInput} />
          <Pressable accessibilityLabel={showPassword ? 'Ocultar senha' : 'Mostrar senha'} accessibilityRole="button" onPress={() => setShowPassword((current) => !current)} style={styles.showPasswordButton}>
            <Text style={styles.showPasswordText}>{showPassword ? 'Ocultar' : 'Mostrar'}</Text>
          </Pressable>
        </View>
        {fieldErrors.password ? <Text style={styles.fieldError}>{fieldErrors.password}</Text> : null}
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
            setFieldErrors({})
          }}
          style={styles.switchButton}
        >
          <Text style={styles.switchText}>
            {registering ? 'Já tenho uma conta' : 'Quero criar uma conta'}
          </Text>
        </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  keyboardView: { flex: 1 },
  container: { flexGrow: 1, padding: 28, backgroundColor: colors.background },
  back: { color: colors.primary, fontSize: 16, marginBottom: 48 },
  title: { color: colors.ink, fontSize: 32, fontWeight: '800', marginBottom: 12 },
  body: { color: colors.muted, fontSize: 16, lineHeight: 24, marginBottom: 28 },
  label: { color: colors.ink, fontSize: 14, fontWeight: '700', marginBottom: 6, marginTop: 8 },
  input: { backgroundColor: '#ffffff', borderColor: colors.line, borderRadius: 12, borderWidth: 1, fontSize: 16, marginBottom: 4, padding: 16 },
  passwordRow: { alignItems: 'center', backgroundColor: '#ffffff', borderColor: colors.line, borderRadius: 12, borderWidth: 1, flexDirection: 'row', marginBottom: 4 },
  passwordInput: { flex: 1, fontSize: 16, padding: 16 },
  showPasswordButton: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 12 },
  showPasswordText: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  fieldError: { color: '#b42318', fontSize: 13, marginBottom: 6, marginTop: 3 },
  error: { color: '#b42318', marginBottom: 12 },
  button: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: 12, marginTop: 8, padding: 16 },
  buttonText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  switchButton: { alignItems: 'center', padding: 16 },
  switchText: { color: colors.primary, fontSize: 16, fontWeight: '700' },
})
