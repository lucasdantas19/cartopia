import assert from 'node:assert/strict'
import test from 'node:test'
import { buildJourneyNarrative } from '../src/utils/journeyNarrative.ts'

const steps = [
  { title: 'Buscar uma flor', description: null, location: { label: 'Keukenhof' }, starts_at: '', arrives_at: '' },
  { title: 'Pausa para um croissant', description: null, location: null, starts_at: '', arrives_at: '' },
]

test('builds a direct-delivery narrative for each status', () => {
  assert.equal(buildJourneyNarrative({ origin: 'Recife', destination: 'Paris', status: 'SCHEDULED', steps: [], currentStep: null }), 'A mensagem está pronta para partir de Recife rumo a Paris.')
  assert.equal(buildJourneyNarrative({ origin: 'Recife', destination: 'Paris', status: 'IN_TRANSIT', steps: [], currentStep: null }), 'A mensagem deixou Recife e está a caminho de Paris.')
  assert.equal(buildJourneyNarrative({ origin: 'Recife', destination: 'Paris', status: 'DELIVERED', steps: [], currentStep: null }), 'A mensagem partiu de Recife e chegou ao seu destino: Paris.')
})

test('describes adventure stops and current chapter automatically', () => {
  assert.equal(buildJourneyNarrative({ origin: 'Recife', destination: 'Paris', status: 'SCHEDULED', steps, currentStep: null }), 'A mensagem partirá de Recife, fará uma pausa em Keukenhof e Pausa para um croissant e seguirá até Paris.')
  assert.equal(buildJourneyNarrative({ origin: 'Recife', destination: 'Paris', status: 'IN_TRANSIT', steps, currentStep: 0 }), 'A mensagem partiu de Recife e agora vive este capítulo: Buscar uma flor. Depois, seguirá para Paris.')
  assert.equal(buildJourneyNarrative({ origin: 'Recife', destination: 'Paris', status: 'DELIVERED', steps, currentStep: null }), 'A mensagem partiu de Recife, passou por Keukenhof e Pausa para um croissant e chegou a Paris.')
})
