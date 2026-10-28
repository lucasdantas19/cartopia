import { useState } from 'react'
import { Link, useRouter } from 'expo-router'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { ApiError, createDelivery } from '../src/api'
import { useSession } from '../src/context/SessionContext'

const locations = [
  'Porto dos Sonhos',
  'Jardim das Ideias',
  'Biblioteca das Memórias',
  'Paris',
  'Disney',
]

const couriers = [
  { code: 'paper-swallow', label: 'Andorinha de Papel' },
  { code: 'postal-cat', label: 'Gatinho Carteiro' },
  { code: 'little-dragon', label: 'Dragão Mensageiro' },
]

export default function CreateScreen() {
  const router = useRouter()
  const { session } = useSession()
  const [senderName, setSenderName] = useState('')
  const [recipientName, setRecipientName] = useState('')
  const [recipientEmail, setRecipientEmail] = useState('')
  const [message, setMessage] = useState('')
  const [origin, setOrigin] = useState(locations[0])
  const [destination, setDestination] = useState(locations[1])
  const [courier, setCourier] = useState(couriers[0].code)
  const [duration, setDuration] = useState('30')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const selectedCourier = couriers.find((item) => item.code === courier) ?? couriers[0]

  async function submit() {
    if (!recipientName.trim() || !message.trim()) {
      setError('Informe o destinatário e escreva uma mensagem.')
      return
    }
    if (origin === destination) {
      setError('Escolha uma origem e um destino diferentes.')
      return
    }

    const durationMinutes = Number(duration)
    if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 1440) {
      setError('A duração deve estar entre 1 e 1440 minutos.')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const response = await createDelivery({
        message: message.trim(),
        sender_name: senderName.trim() || undefined,
        recipient_name: recipientName.trim(),
        recipient_email: recipientEmail.trim() || undefined,
        origin,
        destination,
        courier,
        duration_minutes: durationMinutes,
      }, session?.token)

      router.replace({
        pathname: '/track',
        params: {
          publicId: response.data.public_id,
          token: response.recipient_access_token,
        },
      })
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Não foi possível criar a entrega agora.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <Link href="/" style={styles.back}>← Início</Link>
          <Text style={styles.eyebrow}>NOVA ENTREGA</Text>
          <Text style={styles.title}>Prepare uma surpresa.</Text>
          <Text style={styles.body}>
            Uma carta simples, uma viagem inteira. Você pode criar sem login.
          </Text>

          <View style={styles.steps}>
            <View style={styles.stepActive}><Text style={styles.stepActiveText}>1</Text></View>
            <View style={styles.stepLine} />
            <View style={styles.step}><Text style={styles.stepText}>2</Text></View>
            <View style={styles.stepLine} />
            <View style={styles.step}><Text style={styles.stepText}>3</Text></View>
          </View>
          <View style={styles.stepLabels}>
            <Text style={styles.stepLabelActive}>Mensagem</Text>
            <Text style={styles.stepLabel}>Rota</Text>
            <Text style={styles.stepLabel}>Revisão</Text>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionNumber}>01</Text>
            <Text style={styles.sectionTitle}>Quem vai receber?</Text>
            <Text style={styles.sectionDescription}>Conte-nos para quem essa surpresa vai viajar.</Text>
            <Text style={styles.label}>Seu nome <Text style={styles.optional}>(opcional)</Text></Text>
            <TextInput
              placeholder="Como devemos assinar?"
              value={senderName}
              onChangeText={setSenderName}
              style={styles.input}
            />
            <Text style={styles.label}>Nome do destinatário</Text>
            <TextInput
              placeholder="Quem vai receber?"
              value={recipientName}
              onChangeText={setRecipientName}
              style={styles.input}
            />
            <Text style={styles.label}>E-mail <Text style={styles.optional}>(opcional)</Text></Text>
            <TextInput
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="nome@exemplo.com"
              value={recipientEmail}
              onChangeText={setRecipientEmail}
              style={styles.input}
            />
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionNumber}>02</Text>
            <Text style={styles.sectionTitle}>Escreva a mensagem</Text>
            <Text style={styles.sectionDescription}>É ela que dá sentido à aventura.</Text>
            <TextInput
              multiline
              maxLength={10000}
              numberOfLines={6}
              placeholder="Era uma vez uma mensagem..."
              value={message}
              onChangeText={setMessage}
              style={[styles.input, styles.messageInput]}
              textAlignVertical="top"
            />
            <Text style={styles.characterCount}>{message.length}/10.000 caracteres</Text>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionNumber}>03</Text>
            <Text style={styles.sectionTitle}>Trace a rota</Text>
            <Text style={styles.sectionDescription}>Escolha quem leva e por onde a carta passa.</Text>
            <Text style={styles.label}>Entregador</Text>
            <View style={styles.options}>
              {couriers.map((item) => (
                <Pressable
                  key={item.code}
                  onPress={() => setCourier(item.code)}
                  style={[styles.option, courier === item.code ? styles.selectedOption : undefined]}
                >
                  <Text style={courier === item.code ? styles.selectedOptionText : styles.optionText}>
                    {item.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.label}>Origem</Text>
            <View style={styles.options}>
              {locations.map((item) => (
                <Pressable
                  key={item}
                  onPress={() => setOrigin(item)}
                  style={[styles.option, origin === item ? styles.selectedOption : undefined]}
                >
                  <Text style={origin === item ? styles.selectedOptionText : styles.optionText}>
                    {item}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.label}>Destino</Text>
            <View style={styles.options}>
              {locations.map((item) => (
                <Pressable
                  key={item}
                  onPress={() => setDestination(item)}
                  style={[styles.option, destination === item ? styles.selectedOption : undefined]}
                >
                  <Text style={destination === item ? styles.selectedOptionText : styles.optionText}>
                    {item}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.label}>Duração da viagem</Text>
            <View style={styles.durationRow}>
              <TextInput
                keyboardType="number-pad"
                value={duration}
                onChangeText={setDuration}
                style={[styles.input, styles.durationInput]}
              />
              <Text style={styles.durationUnit}>minutos</Text>
            </View>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>RESUMO DA VIAGEM</Text>
            <Text style={styles.summaryRoute}>{origin} → {destination}</Text>
            <Text style={styles.summaryDetail}>{selectedCourier.label} · {duration} minutos</Text>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable
            disabled={submitting}
            onPress={() => void submit()}
            style={styles.submitButton}
          >
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Criar entrega ✦</Text>}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: '#fffaf4', flex: 1 },
  keyboardView: { flex: 1 },
  container: { backgroundColor: '#fffaf4', flexGrow: 1, padding: 24, paddingBottom: 42 },
  back: { color: '#7c3aed', fontSize: 16, marginBottom: 32, marginTop: 12 },
  eyebrow: { color: '#7c3aed', fontWeight: '800', letterSpacing: 2, marginBottom: 12 },
  title: { color: '#241b35', fontSize: 34, fontWeight: '800', lineHeight: 40 },
  body: { color: '#665d70', fontSize: 16, lineHeight: 24, marginBottom: 24, marginTop: 12 },
  steps: { alignItems: 'center', flexDirection: 'row', marginBottom: 8 },
  stepActive: { alignItems: 'center', backgroundColor: '#7c3aed', borderRadius: 20, height: 32, justifyContent: 'center', width: 32 },
  stepActiveText: { color: '#ffffff', fontWeight: '800' },
  step: { alignItems: 'center', backgroundColor: '#eee8f7', borderRadius: 20, height: 32, justifyContent: 'center', width: 32 },
  stepText: { color: '#8a8193', fontWeight: '800' },
  stepLine: { backgroundColor: '#e5dcef', flex: 1, height: 2, marginHorizontal: 8 },
  stepLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  stepLabelActive: { color: '#7c3aed', fontSize: 12, fontWeight: '700' },
  stepLabel: { color: '#8a8193', fontSize: 12 },
  sectionCard: { backgroundColor: '#ffffff', borderRadius: 20, marginBottom: 16, padding: 18 },
  sectionNumber: { color: '#7c3aed', fontSize: 13, fontWeight: '800', letterSpacing: 1, marginBottom: 6 },
  sectionTitle: { color: '#241b35', fontSize: 22, fontWeight: '800' },
  sectionDescription: { color: '#665d70', fontSize: 14, lineHeight: 20, marginBottom: 8, marginTop: 4 },
  label: { color: '#241b35', fontSize: 15, fontWeight: '700', marginBottom: 8, marginTop: 16 },
  optional: { color: '#8a8193', fontWeight: '400' },
  input: { backgroundColor: '#fffdfb', borderColor: '#e5dcef', borderRadius: 12, borderWidth: 1, fontSize: 16, padding: 15 },
  messageInput: { minHeight: 130 },
  characterCount: { color: '#8a8193', fontSize: 12, marginTop: 8, textAlign: 'right' },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { backgroundColor: '#ffffff', borderColor: '#e5dcef', borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10 },
  selectedOption: { backgroundColor: '#7c3aed', borderColor: '#7c3aed' },
  optionText: { color: '#665d70', fontSize: 14 },
  selectedOptionText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  durationRow: { alignItems: 'center', flexDirection: 'row' },
  durationInput: { flex: 1 },
  durationUnit: { color: '#665d70', fontSize: 15, marginLeft: 12 },
  summaryCard: { backgroundColor: '#f1ebff', borderRadius: 18, marginBottom: 8, padding: 18 },
  summaryLabel: { color: '#7c3aed', fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  summaryRoute: { color: '#241b35', fontSize: 18, fontWeight: '800', marginTop: 8 },
  summaryDetail: { color: '#665d70', fontSize: 14, marginTop: 6 },
  error: { color: '#b42318', fontSize: 15, lineHeight: 22, marginTop: 18 },
  submitButton: { alignItems: 'center', backgroundColor: '#7c3aed', borderRadius: 12, marginTop: 24, padding: 16 },
  submitText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
})
