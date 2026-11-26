import { vi } from 'vitest'

export const book = {
  id: 'cbc65d53-9c56-4b96-b53e-530c2ad5c55d',
  titulo: 'Tokyo Ghoul',
  categoria: { id: 'categoria-1', nome: 'Mangá' },
  autor: [{ id: 'autor-1', nome: 'Sui Ishida' }],
  volume: '1',
  isbn: null,
  capaUrl: '/acervo/capas/cbc65d53-9c56-4b96-b53e-530c2ad5c55d.jpg',
}

export function reservation(number = 1, estado = 'AGUARDANDO_RETIRADA') {
  return {
    id: `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`,
    leitorId: 'leitor-1',
    obraId: book.id,
    exemplarId: '5b3b45e8-4ec2-42a5-ab68-6e58da55c6d9',
    estado,
    criadaEm: '2026-11-25T12:00:00Z',
    retiradaEm: null,
    finalizadaEm: null,
    canceladaEm: null,
  }
}

export function account(roles = ['LEITOR']) {
  const value = {
    roles,
    authenticated: true,
    tokenParsed: { sub: 'leitor-1', name: 'Kaiky Ferreira' },
    token: 'token-de-teste',
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn().mockResolvedValue(undefined),
    updateToken: vi.fn().mockResolvedValue(false),
  }
  value.hasRealmRole = (role) => value.roles.includes(role)
  value.clearToken = vi.fn(() => {
    value.authenticated = false
    value.token = undefined
    value.onAuthLogout?.()
  })
  return value
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export function deferred() {
  let resolve
  const promise = new Promise((done) => {
    resolve = done
  })
  return { promise, resolve }
}
