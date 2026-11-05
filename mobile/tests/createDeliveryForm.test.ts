import assert from 'node:assert/strict'
import test from 'node:test'
import { validateCreateDelivery } from '../src/createDeliveryForm.ts'

const validForm = {
  senderName: '',
  recipientName: 'Ana',
  recipientEmail: '',
  message: 'Uma surpresa',
  deliveryMode: 'real' as const,
  origin: 'Paris',
  destination: 'Disney',
  originLocation: { label: 'Paris', latitude: 48.8566, longitude: 2.3522 },
  destinationLocation: { label: 'Disney', latitude: 28.3852, longitude: -81.5639 },
  duration: '30',
}

test('accepts a delivery with two real places and no optional sender details', () => {
  assert.deepEqual(validateCreateDelivery(validForm), {})
})

test('identifies invalid fields before creating a delivery', () => {
  assert.deepEqual(validateCreateDelivery({
    ...validForm,
    recipientName: ' ',
    recipientEmail: 'invalid',
    message: '  ',
    destination: 'Paris',
    destinationLocation: validForm.originLocation,
    duration: '0',
  }), {
    recipientName: 'Informe o nome do destinatário.',
    recipientEmail: 'Informe um e-mail válido ou deixe o campo vazio.',
    message: 'Escreva a mensagem antes de criar a entrega.',
    destination: 'Origem e destino precisam ser pontos diferentes.',
    duration: 'Escolha uma duração entre 1 e 1440 minutos.',
  })
})
test('requires real coordinates for both places', () => {
  assert.deepEqual(validateCreateDelivery({
    ...validForm,
    origin: '',
    destination: '',
    originLocation: null,
    destinationLocation: null,
  }), {
    origin: 'Escolha uma origem real no mapa.',
    destination: 'Escolha um destino real no mapa.',
  })
})

test('accepts playful places without coordinates', () => {
  assert.deepEqual(validateCreateDelivery({
    ...validForm,
    deliveryMode: 'playful',
    origin: 'Narnia',
    destination: 'O seu coração',
    originLocation: null,
    destinationLocation: null,
  }), {})
})

test('requires different playful place names', () => {
  assert.deepEqual(validateCreateDelivery({
    ...validForm,
    deliveryMode: 'playful',
    origin: 'Narnia',
    destination: 'Narnia',
    originLocation: null,
    destinationLocation: null,
  }), { destination: 'Origem e destino precisam ser diferentes.' })
})

test('allows equal place names when the map points differ', () => {
  assert.deepEqual(validateCreateDelivery({
    ...validForm,
    destination: 'Paris',
    destinationLocation: { label: 'Paris', latitude: 48.86, longitude: 2.36 },
  }), {})
})

test('matches the server limits for names, message, and duration', () => {
  assert.deepEqual(validateCreateDelivery({
    ...validForm,
    senderName: 'A'.repeat(121),
    recipientName: 'B'.repeat(121),
    message: 'C'.repeat(10001),
    duration: '1441',
  }), {
    senderName: 'Seu nome pode ter até 120 caracteres.',
    recipientName: 'O nome pode ter até 120 caracteres.',
    message: 'A mensagem pode ter até 10.000 caracteres.',
    duration: 'Escolha uma duração entre 1 e 1440 minutos.',
  })
})
