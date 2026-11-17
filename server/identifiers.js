import { randomBytes } from 'node:crypto'

export function createUniqueIdentifier(prefix, existingValues, createSuffix = () => randomBytes(6).toString('hex').toUpperCase()) {
  const existing = existingValues instanceof Set ? existingValues : new Set(existingValues)
  for (let attempt = 0; attempt < 10_000; attempt += 1) {
    const identifier = `${prefix}-${new Date().getFullYear()}-${createSuffix()}`
    if (!existing.has(identifier)) return identifier
  }
  throw new Error(`Could not create a unique identifier for ${prefix}.`)
}
