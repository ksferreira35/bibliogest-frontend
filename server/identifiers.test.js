import test from 'node:test'
import assert from 'node:assert/strict'
import { createUniqueIdentifier } from './identifiers.js'

test('creates a randomly generated tombo code', () => {
  const tombo = createUniqueIdentifier('TMB', [])
  assert.match(tombo, /^TMB-\d{4}-[A-F0-9]{12}$/)
})

test('does not reuse an existing identifier', () => {
  const year = new Date().getFullYear()
  const identifier = createUniqueIdentifier('TMB', [`TMB-${year}-REPETIDO`], () => 'REPETIDO-2')
  assert.equal(identifier, `TMB-${year}-REPETIDO-2`)
})

test('generates distinct identifiers for successive users', () => {
  const created = new Set()
  for (let index = 0; index < 500; index += 1) {
    created.add(createUniqueIdentifier('ACA', created))
  }
  assert.equal(created.size, 500)
})
