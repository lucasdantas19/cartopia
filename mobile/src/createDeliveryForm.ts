import type { DeliveryLocation, DestinationSource } from './domain'

export type CreateDeliveryForm = {
  senderName: string
  recipientName: string
  recipientEmail: string
  message: string
  origin: string
  destination: string
  originLocation: DeliveryLocation | null
  destinationLocation: DeliveryLocation | null
  duration: string
  destinationSource?: DestinationSource
}

export type CreateDeliveryField = Exclude<keyof CreateDeliveryForm, 'originLocation' | 'destinationLocation'>
export type CreateDeliveryErrors = Partial<Record<CreateDeliveryField, string>>

function validLocation(location: DeliveryLocation | null): location is DeliveryLocation {
  return Boolean(
    location?.label.trim() &&
    location.label.length <= 160 &&
    Number.isFinite(location.latitude) &&
    location.latitude >= -90 &&
    location.latitude <= 90 &&
    Number.isFinite(location.longitude) &&
    location.longitude >= -180 &&
    location.longitude <= 180,
  )
}

export function validateCreateDelivery(form: CreateDeliveryForm): CreateDeliveryErrors {
  const errors: CreateDeliveryErrors = {}
  const senderName = form.senderName.trim()
  const recipientName = form.recipientName.trim()
  const recipientEmail = form.recipientEmail.trim()
  const message = form.message.trim()
  const duration = Number(form.duration)

  if (senderName.length > 120) errors.senderName = 'Seu nome pode ter até 120 caracteres.'
  if (!recipientName) errors.recipientName = 'Informe o nome do destinatário.'
  else if (recipientName.length > 120) errors.recipientName = 'O nome pode ter até 120 caracteres.'

  if (recipientEmail.length > 255 || (recipientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail))) {
    errors.recipientEmail = 'Informe um e-mail válido ou deixe o campo vazio.'
  }

  if (!message) errors.message = 'Escreva a mensagem antes de criar a entrega.'
  else if (message.length > 10000) errors.message = 'A mensagem pode ter até 10.000 caracteres.'

  if (!validLocation(form.originLocation)) errors.origin = 'Escolha uma origem real no mapa.'
  if ((form.destinationSource ?? 'specific') === 'specific' && !validLocation(form.destinationLocation)) errors.destination = 'Escolha um destino real no mapa.'
  if (form.originLocation && form.destinationLocation &&
    form.originLocation.latitude === form.destinationLocation.latitude &&
    form.originLocation.longitude === form.destinationLocation.longitude) {
    errors.destination = 'Origem e destino precisam ser pontos diferentes.'
  }
  if (!form.duration.trim() || !Number.isInteger(duration) || duration < 1 || duration > 1440) {
    errors.duration = 'Escolha uma duração entre 1 e 1440 minutos.'
  }

  return errors
}
