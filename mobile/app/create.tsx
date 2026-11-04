import { useRef, useState } from 'react'
import * as Clipboard from 'expo-clipboard'
import { Link, usePreventRemove, useRouter } from 'expo-router'
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ScrollViewInstance,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ApiError, createDelivery } from '../src/api'
import { webUrl } from '../src/config'
import { RealLocationPicker } from '../src/components/RealLocationPicker'
import { useSession } from '../src/context/SessionContext'
import { createDeliveryShareUrl, previewDeliveryShareUrl } from '../src/deepLinks'
import type { DeliveryLocation } from '../src/domain'
import { saveRecentDelivery } from '../src/recentDeliveries'
import {
  validateCreateDelivery,
  type CreateDeliveryErrors,
  type CreateDeliveryField,
} from '../src/createDeliveryForm'

const initialMapCenter = { latitude: -8.047, longitude: -34.912 }

const couriers = [
  {
    code: 'paper-swallow',
    label: 'Andorinha de Papel',
    image: require('../assets/couriers/paper-swallow-icon.png'),
  },
  {
    code: 'postal-cat',
    label: 'Gatinho Carteiro',
    image: require('../assets/couriers/postal-cat-icon.png'),
  },
  {
    code: 'little-dragon',
    label: 'Dragão Mensageiro',
    image: require('../assets/couriers/little-dragon-icon.png'),
  },
]

export default function CreateScreen() {
  const router = useRouter()
  const { session, sessionExpired } = useSession()
  const scrollRef = useRef<ScrollViewInstance>(null)
  const fieldOffsets = useRef<Partial<Record<CreateDeliveryField, number>>>({})
  const sectionOffsets = useRef({ recipient: 0, message: 0, route: 0 })
  const [senderName, setSenderName] = useState('')
  const [recipientName, setRecipientName] = useState('')
  const [recipientEmail, setRecipientEmail] = useState('')
  const [message, setMessage] = useState('')
  const [originLocation, setOriginLocation] = useState<DeliveryLocation | null>(null)
  const [destinationLocation, setDestinationLocation] = useState<DeliveryLocation | null>(null)
  const [mapPickerOpen, setMapPickerOpen] = useState<'origin' | 'destination' | null>(null)
  const [courier, setCourier] = useState(couriers[0].code)
  const [duration, setDuration] = useState('30')
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<CreateDeliveryErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [copying, setCopying] = useState(false)
  const [copiedLink, setCopiedLink] = useState<'sender' | 'recipient' | null>(null)
  const [expandedLink, setExpandedLink] = useState<'sender' | 'recipient' | null>(null)
  const [recentSaveState, setRecentSaveState] = useState<'idle' | 'saved' | 'failed'>('idle')
  const [created, setCreated] = useState<{
    publicId: string
    recipientToken: string
    senderToken: string
  } | null>(null)

  const selectedCourier = couriers.find((item) => item.code === courier) ?? couriers[0]
  const origin = originLocation?.label ?? ''
  const destination = destinationLocation?.label ?? ''
  const hasDraft = Boolean(
    senderName || recipientName || recipientEmail || message ||
    originLocation || destinationLocation || courier !== couriers[0].code || duration !== '30',
  )
  const disablePrevention = usePreventRemove(hasDraft && !created, ({ repeat }) => {
    Alert.alert(
      'Descartar mensagem?',
      'O texto e as escolhas desta entrega serão perdidos.',
      [
        { text: 'Continuar editando', style: 'cancel' },
        {
          text: 'Descartar',
          style: 'destructive',
          onPress: () => {
            disablePrevention()
            repeat()
          },
        },
      ],
    )
  })

  function clearFieldError(field: CreateDeliveryField) {
    setFieldErrors((current) => ({ ...current, [field]: undefined }))
  }

  function showFieldErrors(errors: CreateDeliveryErrors) {
    setFieldErrors(errors)
    const firstField = (Object.keys(errors) as CreateDeliveryField[]).find((field) => Boolean(errors[field]))
    if (firstField) {
      const section = firstField === 'message'
        ? 'message'
        : ['origin', 'destination', 'duration'].includes(firstField) ? 'route' : 'recipient'
      const y = sectionOffsets.current[section] + (fieldOffsets.current[firstField] ?? 0)
      scrollRef.current?.scrollTo({ y: Math.max(0, y - 24), animated: true })
    }
  }

  async function submit() {
    if (sessionExpired) {
      setError('Sua sessão terminou. Entre novamente antes de criar a entrega.')
      return
    }

    const validationErrors = validateCreateDelivery({
      senderName,
      recipientName,
      recipientEmail,
      message,
      origin,
      destination,
      originLocation,
      destinationLocation,
      duration,
    })
    if (Object.keys(validationErrors).length) {
      showFieldErrors(validationErrors)
      setError('Revise os campos indicados antes de criar a entrega.')
      return
    }
    if (!originLocation || !destinationLocation) {
      setError('Escolha a origem e o destino no mapa antes de criar a entrega.')
      return
    }

    const durationMinutes = Number(duration)
    setSubmitting(true)
    setError('')
    setFieldErrors({})
    try {
      const response = await createDelivery({
        message: message.trim(),
        sender_name: senderName.trim() || undefined,
        recipient_name: recipientName.trim(),
        recipient_email: recipientEmail.trim() || undefined,
        origin,
        origin_location: originLocation,
        destination,
        destination_location: destinationLocation,
        courier,
        duration_minutes: durationMinutes,
      }, session?.token)

      if (Platform.OS !== 'web') {
        try {
          await saveRecentDelivery({
            publicId: response.data.public_id,
            accessToken: response.sender_access_token,
            role: 'sender',
            recipientName: recipientName.trim(),
            origin,
            destination,
            createdAt: new Date().toISOString(),
          })
          setRecentSaveState('saved')
        } catch {
          setRecentSaveState('failed')
        }
      }

      setCreated({
        publicId: response.data.public_id,
        recipientToken: response.recipient_access_token,
        senderToken: response.sender_access_token,
      })
    } catch (caught) {
      if (caught instanceof ApiError && caught.errors) {
        const errors = caught.errors
        showFieldErrors({
          senderName: errors.sender_name?.[0],
          recipientName: errors.recipient_name?.[0],
          recipientEmail: errors.recipient_email?.[0],
          message: errors.message?.[0],
          origin: errors.origin?.[0]
            ?? errors.origin_location?.[0]
            ?? errors['origin_location.label']?.[0]
            ?? errors['origin_location.latitude']?.[0]
            ?? errors['origin_location.longitude']?.[0],
          destination: errors.destination?.[0]
            ?? errors.destination_location?.[0]
            ?? errors['destination_location.label']?.[0]
            ?? errors['destination_location.latitude']?.[0]
            ?? errors['destination_location.longitude']?.[0],
          duration: errors.duration_minutes?.[0],
        })
      }
      setError(caught instanceof ApiError ? caught.message : 'Não foi possível criar a entrega agora.')
    } finally {
      setSubmitting(false)
    }
  }

  async function shareLink(role: 'sender' | 'recipient') {
    if (!created) return
    const token = role === 'sender' ? created.senderToken : created.recipientToken
    const url = createDeliveryShareUrl(webUrl, created.publicId, token, role)
    if (!url) return

    setSharing(true)
    setError('')
    try {
      await Share.share({ message: url })
    } catch {
      setError('Não foi possível compartilhar. Copie o link ou abra a versão completa abaixo.')
    } finally {
      setSharing(false)
    }
  }

  async function copyLink(role: 'sender' | 'recipient') {
    if (!created) return
    const token = role === 'sender' ? created.senderToken : created.recipientToken
    const url = createDeliveryShareUrl(webUrl, created.publicId, token, role)
    if (!url) return

    setCopying(true)
    setCopiedLink(null)
    setError('')
    try {
      const copied = await Clipboard.setStringAsync(url)
      if (!copied) throw new Error('Clipboard unavailable')
      setCopiedLink(role)
    } catch {
      setError('Não foi possível copiar automaticamente. Abra o link completo abaixo para selecionar e copiar.')
      setExpandedLink(role)
    } finally {
      setCopying(false)
    }
  }

  if (created) {
    const recipientUrl = createDeliveryShareUrl(webUrl, created.publicId, created.recipientToken, 'recipient')
    const senderUrl = createDeliveryShareUrl(webUrl, created.publicId, created.senderToken, 'sender')

    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.container}>
          <Text style={styles.eyebrow}>ENTREGA CRIADA</Text>
          <Text style={styles.title}>Sua carta começou a viagem.</Text>
          <Text style={styles.body}>
            Envie o link do destinatário para quem vai receber a surpresa. Guarde o seu link para acompanhar a viagem.
          </Text>

          {!recipientUrl || !senderUrl ? (
            <Text style={styles.error}>
              Os links ainda não estão disponíveis neste ambiente. A configuração do endereço web precisa ser concluída.
            </Text>
          ) : (
            <>
              <View style={styles.successCard}>
                <Text style={styles.sectionTitle}>Link do destinatário</Text>
                <Text style={styles.sectionDescription}>
                  Compartilhe este link para que a pessoa acompanhe e abra a carta quando ela chegar.
                </Text>
                <View style={styles.linkPreview}>
                  <Text style={styles.linkPreviewRole}>PARA QUEM RECEBE</Text>
                  <Text numberOfLines={1} style={styles.linkPreviewText}>
                    {previewDeliveryShareUrl(recipientUrl)}
                  </Text>
                </View>
                <View style={styles.linkActions}>
                  <Pressable
                    accessibilityLabel="Compartilhar link do destinatário"
                    accessibilityRole="button"
                    disabled={sharing}
                    onPress={() => void shareLink('recipient')}
                    style={styles.linkPrimaryButton}
                  >
                    <Text style={styles.linkPrimaryText}>Compartilhar</Text>
                  </Pressable>
                  <Pressable
                    accessibilityLabel="Copiar link do destinatário"
                    accessibilityRole="button"
                    disabled={copying}
                    onPress={() => void copyLink('recipient')}
                    style={styles.linkSecondaryButton}
                  >
                    <Text style={styles.linkSecondaryText}>Copiar link</Text>
                  </Pressable>
                </View>
                {copiedLink === 'recipient' ? (
                  <Text accessibilityRole="alert" style={styles.copiedText}>Link completo copiado.</Text>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setExpandedLink(expandedLink === 'recipient' ? null : 'recipient')}
                  style={styles.revealLinkButton}
                >
                  <Text style={styles.revealLinkText}>
                    {expandedLink === 'recipient' ? 'Ocultar link completo' : 'Ver link completo'}
                  </Text>
                </Pressable>
                {expandedLink === 'recipient' ? (
                  <Text selectable style={styles.shareUrl}>{recipientUrl}</Text>
                ) : null}
              </View>

              <View style={styles.successCard}>
                <Text style={styles.sectionTitle}>Seu link de remetente</Text>
                <Text style={styles.sectionDescription}>
                  Guarde este link. Ele dá acesso ao acompanhamento do remetente.
                </Text>
                <View style={styles.linkPreview}>
                  <Text style={styles.linkPreviewRole}>PARA VOCÊ</Text>
                  <Text numberOfLines={1} style={styles.linkPreviewText}>
                    {previewDeliveryShareUrl(senderUrl)}
                  </Text>
                </View>
                <View style={styles.linkActions}>
                  <Pressable
                    accessibilityLabel="Copiar meu link de remetente"
                    accessibilityRole="button"
                    disabled={copying}
                    onPress={() => void copyLink('sender')}
                    style={styles.linkPrimaryButton}
                  >
                    <Text style={styles.linkPrimaryText}>Copiar link</Text>
                  </Pressable>
                  <Pressable
                    accessibilityLabel="Compartilhar meu link de remetente"
                    accessibilityRole="button"
                    disabled={sharing}
                    onPress={() => void shareLink('sender')}
                    style={styles.linkSecondaryButton}
                  >
                    <Text style={styles.linkSecondaryText}>Compartilhar</Text>
                  </Pressable>
                </View>
                {copiedLink === 'sender' ? (
                  <Text accessibilityRole="alert" style={styles.copiedText}>Link completo copiado.</Text>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setExpandedLink(expandedLink === 'sender' ? null : 'sender')}
                  style={styles.revealLinkButton}
                >
                  <Text style={styles.revealLinkText}>
                    {expandedLink === 'sender' ? 'Ocultar link completo' : 'Ver link completo'}
                  </Text>
                </Pressable>
                {expandedLink === 'sender' ? (
                  <Text selectable style={styles.shareUrl}>{senderUrl}</Text>
                ) : null}
              </View>
            </>
          )}

          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          {recentSaveState === 'saved' ? (
            <Text style={styles.localSaveNote}>
              Esta entrega está em Recentes neste celular, na tela inicial. Guarde seu link para acessar em outro aparelho.
            </Text>
          ) : null}
          {recentSaveState === 'failed' ? (
            <Text accessibilityRole="alert" style={styles.localSaveError}>
              A entrega foi criada, mas não pôde ser salva neste celular. Guarde seu link de remetente.
            </Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace({
              pathname: '/track',
              params: { publicId: created.publicId, token: created.senderToken },
            })}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>Acompanhar como remetente</Text>
          </Pressable>
          <Link href="/" style={styles.backHome}>Voltar ao início</Link>
        </ScrollView>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {mapPickerOpen ? (
        <RealLocationPicker
          kind={mapPickerOpen}
          initialCenter={originLocation ?? destinationLocation ?? initialMapCenter}
          initialLocation={mapPickerOpen === 'origin' ? originLocation : destinationLocation}
          otherLocation={mapPickerOpen === 'origin' ? destinationLocation : originLocation}
          onClose={() => setMapPickerOpen(null)}
          onSelect={(location) => {
            if (mapPickerOpen === 'origin') {
              setOriginLocation(location)
              clearFieldError('origin')
            } else {
              setDestinationLocation(location)
              clearFieldError('destination')
            }
            setMapPickerOpen(null)
          }}
        />
      ) : null}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          ref={scrollRef}
        >
          <Link href="/" style={styles.back}>← Início</Link>
          <Text style={styles.eyebrow}>NOVA ENTREGA</Text>
          <Text style={styles.title}>Prepare uma surpresa.</Text>
          <Text style={styles.body}>
            Uma carta simples, uma viagem inteira. Você pode criar sem login.
          </Text>

          <View
            onLayout={(event) => {
              sectionOffsets.current.recipient = event.nativeEvent.layout.y
            }}
            style={styles.sectionCard}
          >
            <Text style={styles.sectionNumber}>01</Text>
            <Text style={styles.sectionTitle}>Quem vai receber?</Text>
            <Text style={styles.sectionDescription}>Conte-nos para quem essa surpresa vai viajar.</Text>
            <View
              onLayout={(event) => {
                fieldOffsets.current.senderName = event.nativeEvent.layout.y
              }}
            >
              <Text style={styles.label}>Seu nome <Text style={styles.optional}>(opcional)</Text></Text>
              <TextInput
                accessibilityLabel="Seu nome, opcional"
                autoComplete="name"
                maxLength={120}
                placeholder="Como devemos assinar?"
                value={senderName}
                onChangeText={(value) => {
                  setSenderName(value)
                  clearFieldError('senderName')
                }}
                style={styles.input}
              />
              {fieldErrors.senderName ? <Text style={styles.fieldError}>{fieldErrors.senderName}</Text> : null}
            </View>
            <View
              onLayout={(event) => {
                fieldOffsets.current.recipientName = event.nativeEvent.layout.y
              }}
            >
              <Text style={styles.label}>Nome do destinatário</Text>
              <TextInput
                accessibilityLabel="Nome do destinatário"
                maxLength={120}
                placeholder="Quem vai receber?"
                value={recipientName}
                onChangeText={(value) => {
                  setRecipientName(value)
                  clearFieldError('recipientName')
                }}
                style={styles.input}
              />
              {fieldErrors.recipientName ? <Text style={styles.fieldError}>{fieldErrors.recipientName}</Text> : null}
            </View>
            <View
              onLayout={(event) => {
                fieldOffsets.current.recipientEmail = event.nativeEvent.layout.y
              }}
            >
              <Text style={styles.label}>E-mail do destinatário <Text style={styles.optional}>(opcional)</Text></Text>
              <Text style={styles.fieldHint}>
                Ajuda a associar a entrega à conta da pessoa. Você ainda precisará enviar o link após criar.
              </Text>
              <TextInput
                accessibilityLabel="E-mail do destinatário, opcional"
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                maxLength={255}
                placeholder="nome@exemplo.com"
                value={recipientEmail}
                onChangeText={(value) => {
                  setRecipientEmail(value)
                  clearFieldError('recipientEmail')
                }}
                style={styles.input}
              />
              {fieldErrors.recipientEmail ? <Text style={styles.fieldError}>{fieldErrors.recipientEmail}</Text> : null}
            </View>
          </View>

          <View
            onLayout={(event) => {
              sectionOffsets.current.message = event.nativeEvent.layout.y
            }}
            style={styles.sectionCard}
          >
            <Text style={styles.sectionNumber}>02</Text>
            <Text style={styles.sectionTitle}>Escreva a mensagem</Text>
            <Text style={styles.sectionDescription}>É ela que dá sentido à aventura.</Text>
            <View
              onLayout={(event) => {
                fieldOffsets.current.message = event.nativeEvent.layout.y
              }}
            >
              <TextInput
                accessibilityLabel="Mensagem da entrega"
                multiline
                maxLength={10000}
                numberOfLines={6}
                placeholder="Era uma vez uma mensagem..."
                value={message}
                onChangeText={(value) => {
                  setMessage(value)
                  clearFieldError('message')
                }}
                style={[styles.input, styles.messageInput]}
                textAlignVertical="top"
              />
              {fieldErrors.message ? <Text style={styles.fieldError}>{fieldErrors.message}</Text> : null}
              <Text style={styles.characterCount}>{message.length}/10.000 caracteres</Text>
            </View>
          </View>

          <View
            onLayout={(event) => {
              sectionOffsets.current.route = event.nativeEvent.layout.y
            }}
            style={styles.sectionCard}
          >
            <Text style={styles.sectionNumber}>03</Text>
            <Text style={styles.sectionTitle}>Trace a rota</Text>
            <Text style={styles.sectionDescription}>Escolha quem leva e por onde a carta passa.</Text>
            <Text style={styles.label}>Entregador</Text>
            <View style={styles.courierOptions}>
              {couriers.map((item) => (
                <Pressable
                  accessibilityLabel={item.label}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: courier === item.code }}
                  key={item.code}
                  onPress={() => setCourier(item.code)}
                  style={[
                    styles.courierOption,
                    courier === item.code ? styles.selectedCourierOption : undefined,
                  ]}
                >
                  <View
                    style={[
                      styles.courierImageRing,
                      courier === item.code ? styles.selectedCourierImageRing : undefined,
                    ]}
                  >
                    <Image
                      accessible={false}
                      source={item.image}
                      style={styles.courierImage}
                    />
                  </View>
                  <Text
                    numberOfLines={2}
                    style={[
                      styles.courierLabel,
                      courier === item.code ? styles.selectedCourierLabel : undefined,
                    ]}
                  >
                    {item.label}
                  </Text>
                  {courier === item.code ? (
                    <Text style={styles.courierSelectedText}>Selecionado</Text>
                  ) : null}
                </Pressable>
              ))}
            </View>
            <View
              onLayout={(event) => {
                fieldOffsets.current.origin = event.nativeEvent.layout.y
              }}
            >
              <Text style={styles.label}>Origem</Text>
              <Text style={styles.fieldHint}>Escolha no mapa de onde a carta vai partir.</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setMapPickerOpen('origin')}
                style={[
                  styles.mapChoice,
                  originLocation ? styles.selectedMapChoice : undefined,
                ]}
              >
                <Text style={styles.mapChoiceIcon}>⌖</Text>
                <View style={styles.locationChoiceText}>
                  <Text style={styles.locationChoiceName}>
                    {origin || 'Escolher origem no mapa'}
                  </Text>
                  <Text style={styles.locationChoiceDescription}>
                    {originLocation ? 'Toque para alterar este lugar' : 'Pesquise um endereço ou marque um ponto.'}
                  </Text>
                </View>
                <Text style={styles.mapChoiceArrow}>›</Text>
              </Pressable>
              {fieldErrors.origin ? <Text style={styles.fieldError}>{fieldErrors.origin}</Text> : null}
            </View>
            <View
              onLayout={(event) => {
                fieldOffsets.current.destination = event.nativeEvent.layout.y
              }}
            >
              <Text style={styles.label}>Destino</Text>
              <Text style={styles.fieldHint}>Escolha no mapa onde a carta vai chegar.</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setMapPickerOpen('destination')}
                style={[
                  styles.mapChoice,
                  destinationLocation ? styles.selectedMapChoice : undefined,
                ]}
              >
                <Text style={styles.mapChoiceIcon}>⌖</Text>
                <View style={styles.locationChoiceText}>
                  <Text style={styles.locationChoiceName}>
                    {destination || 'Escolher destino no mapa'}
                  </Text>
                  <Text style={styles.locationChoiceDescription}>
                    {destinationLocation ? 'Toque para alterar este lugar' : 'Pesquise um endereço ou marque um ponto.'}
                  </Text>
                </View>
                <Text style={styles.mapChoiceArrow}>›</Text>
              </Pressable>
              {fieldErrors.destination ? <Text style={styles.fieldError}>{fieldErrors.destination}</Text> : null}
            </View>
            <View
              onLayout={(event) => {
                fieldOffsets.current.duration = event.nativeEvent.layout.y
              }}
            >
              <Text style={styles.label}>Duração da viagem</Text>
              <Text style={styles.fieldHint}>
                A carta chegará ao destino após esse tempo. Escolha entre 1 minuto e 24 horas.
              </Text>
              <View style={styles.durationRow}>
                <TextInput
                  accessibilityLabel="Duração da viagem em minutos"
                  keyboardType="number-pad"
                  maxLength={4}
                  value={duration}
                  onChangeText={(value) => {
                    setDuration(value)
                    clearFieldError('duration')
                  }}
                  style={[styles.input, styles.durationInput]}
                />
                <Text style={styles.durationUnit}>minutos</Text>
              </View>
              {fieldErrors.duration ? <Text style={styles.fieldError}>{fieldErrors.duration}</Text> : null}
            </View>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>CONFIRA ANTES DE CRIAR</Text>
            <Text style={styles.summaryRecipient}>Para {recipientName.trim() || 'quem vai receber'}</Text>
            <Text style={styles.summaryMessage} numberOfLines={3}>
              {message.trim() || 'Sua mensagem aparecerá aqui.'}
            </Text>
            <Text style={styles.summaryRoute}>
              {origin || 'Origem não escolhida'} → {destination || 'Destino não escolhido'}
            </Text>
            <Text style={styles.summaryDetail}>{selectedCourier.label} · {duration} minutos</Text>
          </View>

          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          {sessionExpired ? (
            <Link href="/auth" style={styles.back}>Entrar novamente</Link>
          ) : null}
          <Pressable
            accessibilityRole="button"
            disabled={submitting}
            onPress={() => void submit()}
            style={styles.submitButton}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>Criar entrega ✦</Text>
            )}
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
  sectionCard: { backgroundColor: '#ffffff', borderRadius: 20, marginBottom: 16, padding: 18 },
  sectionNumber: { color: '#7c3aed', fontSize: 13, fontWeight: '800', letterSpacing: 1, marginBottom: 6 },
  sectionTitle: { color: '#241b35', fontSize: 22, fontWeight: '800' },
  sectionDescription: { color: '#665d70', fontSize: 14, lineHeight: 20, marginBottom: 8, marginTop: 4 },
  label: { color: '#241b35', fontSize: 15, fontWeight: '700', marginBottom: 8, marginTop: 16 },
  optional: { color: '#8a8193', fontWeight: '400' },
  fieldHint: { color: '#665d70', fontSize: 13, lineHeight: 19, marginBottom: 10 },
  fieldError: { color: '#b42318', fontSize: 14, lineHeight: 20, marginTop: 8 },
  input: { backgroundColor: '#fffdfb', borderColor: '#e5dcef', borderRadius: 12, borderWidth: 1, fontSize: 16, padding: 15 },
  messageInput: { minHeight: 130 },
  characterCount: { color: '#8a8193', fontSize: 12, marginTop: 8, textAlign: 'right' },
  courierOptions: { flexDirection: 'row', gap: 8 },
  courierOption: { alignItems: 'center', borderColor: '#e5dcef', borderRadius: 16, borderWidth: 1, flex: 1, minWidth: 0, paddingHorizontal: 4, paddingVertical: 10 },
  selectedCourierOption: { backgroundColor: '#f1ebff', borderColor: '#7c3aed' },
  courierImageRing: { alignItems: 'center', borderColor: 'transparent', borderRadius: 32, borderWidth: 3, height: 64, justifyContent: 'center', width: 64 },
  selectedCourierImageRing: { borderColor: '#7c3aed' },
  courierImage: { borderRadius: 29, height: 58, width: 58 },
  courierLabel: { color: '#665d70', fontSize: 12, fontWeight: '700', lineHeight: 16, marginTop: 8, textAlign: 'center' },
  selectedCourierLabel: { color: '#4b2782' },
  courierSelectedText: { color: '#7c3aed', fontSize: 10, fontWeight: '800', marginTop: 3 },
  mapChoice: { alignItems: 'center', backgroundColor: '#fffdfb', borderColor: '#e5dcef', borderRadius: 14, borderWidth: 1, flexDirection: 'row', minHeight: 76, marginTop: 10, padding: 14 },
  selectedMapChoice: { backgroundColor: '#f1ebff', borderColor: '#7c3aed' },
  mapChoiceIcon: { color: '#7c3aed', fontSize: 28, marginRight: 12 },
  locationChoiceText: { flex: 1, paddingRight: 10 },
  locationChoiceName: { color: '#241b35', fontSize: 15, fontWeight: '800' },
  locationChoiceDescription: { color: '#665d70', fontSize: 13, lineHeight: 19, marginTop: 4 },
  mapChoiceArrow: { color: '#7c3aed', fontSize: 28 },
  durationRow: { alignItems: 'center', flexDirection: 'row' },
  durationInput: { flex: 1 },
  durationUnit: { color: '#665d70', fontSize: 15, marginLeft: 12 },
  summaryCard: { backgroundColor: '#f1ebff', borderRadius: 18, marginBottom: 8, padding: 18 },
  summaryLabel: { color: '#7c3aed', fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  summaryRecipient: { color: '#241b35', fontSize: 18, fontWeight: '800', marginTop: 12 },
  summaryMessage: { color: '#665d70', fontSize: 15, lineHeight: 22, marginTop: 8 },
  summaryRoute: { color: '#241b35', fontSize: 18, fontWeight: '800', marginTop: 8 },
  summaryDetail: { color: '#665d70', fontSize: 14, marginTop: 6 },
  error: { color: '#b42318', fontSize: 15, lineHeight: 22, marginTop: 18 },
  submitButton: { alignItems: 'center', backgroundColor: '#7c3aed', borderRadius: 12, marginTop: 24, padding: 16 },
  submitText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  successCard: { backgroundColor: '#ffffff', borderRadius: 20, marginBottom: 16, padding: 18 },
  linkPreview: {
    backgroundColor: '#f7f2ff',
    borderRadius: 12,
    marginTop: 16,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  linkPreviewText: {
    color: '#4b2782',
    fontSize: 15,
    fontWeight: '700',
  },
  linkPreviewRole: {
    color: '#7c3aed',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 4,
  },
  linkActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  linkPrimaryButton: {
    alignItems: 'center',
    backgroundColor: '#7c3aed',
    borderRadius: 12,
    flex: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 8,
  },
  linkPrimaryText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  linkSecondaryButton: {
    alignItems: 'center',
    borderColor: '#d7c6f1',
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 8,
  },
  linkSecondaryText: {
    color: '#7c3aed',
    fontSize: 14,
    fontWeight: '700',
  },
  copiedText: {
    color: '#24724b',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 10,
  },
  revealLinkButton: {
    alignSelf: 'flex-start',
    justifyContent: 'center',
    minHeight: 44,
    marginTop: 4,
  },
  revealLinkText: {
    color: '#7c3aed',
    fontSize: 13,
    fontWeight: '700',
  },
  shareUrl: {
    color: '#554766',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 4,
  },
  localSaveNote: {
    color: '#24724b',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 4,
    marginTop: 10,
  },
  localSaveError: {
    color: '#b42318',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 4,
    marginTop: 10,
  },
  secondaryButton: { alignItems: 'center', borderColor: '#e5dcef', borderRadius: 12, borderWidth: 1, marginTop: 16, padding: 16 },
  secondaryButtonText: { color: '#7c3aed', fontSize: 16, fontWeight: '700' },
  backHome: { color: '#7c3aed', fontSize: 16, marginBottom: 24, marginTop: 28, textAlign: 'center' },
})
