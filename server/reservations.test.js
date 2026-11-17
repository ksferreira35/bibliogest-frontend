import test from 'node:test'
import assert from 'node:assert/strict'
import { stockDeltaForStatusChange } from './reservations.js'

test('confirmation keeps the reserved copy unavailable', () => {
  assert.equal(stockDeltaForStatusChange('Aguardando retirada', 'Retirado'), 0)
})

test('cancellation returns a copy to the local inventory', () => {
  assert.equal(stockDeltaForStatusChange('Aguardando retirada', 'Cancelada'), 1)
})

test('reopening a cancelled reservation consumes an available copy', () => {
  assert.equal(stockDeltaForStatusChange('Cancelada', 'Aguardando retirada'), -1)
})
