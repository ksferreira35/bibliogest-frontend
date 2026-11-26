import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { account, json } from './fixtures.js'

const state = vi.hoisted(() => ({ account: undefined }))
vi.mock('keycloak-js', () => ({
  default: vi.fn(function Keycloak() {
    return state.account
  }),
}))

const publicConfig = {
  keycloakUrl: 'https://login.ksferreira.org',
  realm: 'bibliogest',
  clientId: 'bibliogest-react',
  acervoUrl: '/acervo/api',
  reservasUrl: '/reservas/api',
}

let config
let fetchMock

beforeEach(() => {
  vi.resetModules()
  config = { ...publicConfig }
  state.account = account()
  state.account.init = vi.fn().mockResolvedValue(true)
  fetchMock = vi.fn(async (url) =>
    typeof url === 'string' && url.startsWith('/config')
      ? json(config)
      : json([]),
  )
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => vi.unstubAllGlobals())

describe('autenticação e envio do token', () => {
  it('inicializa o cliente público com PKCE S256 sem gravar tokens no armazenamento', async () => {
    const storage = vi.spyOn(Storage.prototype, 'setItem')
    const { apiFetch } = await import('../src/auth.js')
    await apiFetch('acervo', '/v1/obras')
    expect(state.account.init).toHaveBeenCalledWith(
      expect.objectContaining({ pkceMethod: 'S256' }),
    )
    const [url, options] = fetchMock.mock.calls.at(-1)
    expect(url.pathname).toBe('/acervo/api/v1/obras')
    expect(options.headers.get('Authorization')).toBe('Bearer token-de-teste')
    expect(options.redirect).toBe('error')
    expect(storage).not.toHaveBeenCalled()
  })

  it('usa o token renovado antes de enviar a requisição', async () => {
    state.account.updateToken.mockImplementation(async () => {
      state.account.token = 'token-renovado'
      return true
    })
    const { apiFetch } = await import('../src/auth.js')
    await apiFetch('reservas', '/v1/reservas/minhas')
    expect(fetchMock.mock.calls.at(-1)[1].headers.get('Authorization')).toBe(
      'Bearer token-renovado',
    )
  })

  it('encerra a sessão e não chama a API quando a renovação falha', async () => {
    state.account.updateToken.mockRejectedValue(new Error('Sessão expirada'))
    const { apiFetch } = await import('../src/auth.js')
    await expect(apiFetch('acervo', '/v1/obras')).rejects.toThrow(
      'Sua sessão expirou',
    )
    expect(state.account.clearToken).toHaveBeenCalledOnce()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('não chama endpoints de negócio sem autenticação', async () => {
    state.account.authenticated = false
    const { apiFetch } = await import('../src/auth.js')
    await expect(apiFetch('acervo', '/v1/obras')).rejects.toThrow('Faça login')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it.each(['//externo.invalid/token', '/../outra-api', '/%2e%2e/fora'])(
    'recusa caminho fora do prefixo: %s',
    async (path) => {
      const { apiFetch } = await import('../src/auth.js')
      await expect(apiFetch('acervo', path)).rejects.toThrow(
        'Caminho de API inválido',
      )
      expect(fetchMock).toHaveBeenCalledTimes(1)
    },
  )

  it('não envia o token para uma origem externa indicada na configuração', async () => {
    config.acervoUrl = 'https://externo.invalid/acervo/api'
    const { apiFetch } = await import('../src/auth.js')
    await expect(apiFetch('acervo', '/v1/obras')).rejects.toThrow(
      'Caminho de API inválido',
    )
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('recusa Keycloak HTTP fora do localhost', async () => {
    config.keycloakUrl = 'http://login.example.test'
    const { initializeAuth } = await import('../src/auth.js')
    await expect(initializeAuth()).rejects.toThrow('O login exige HTTPS')
    expect(state.account.init).not.toHaveBeenCalled()
  })

  it('usa o retorno configurado para logout no desenvolvimento', async () => {
    config.logoutRedirectUri = 'http://localhost:5173'
    const { initializeAuth, logout } = await import('../src/auth.js')
    await initializeAuth()
    await logout()
    expect(state.account.logout).toHaveBeenCalledWith({
      redirectUri: 'http://localhost:5173',
    })
  })

  it('usa a origem da aplicação no logout quando não há sobrescrita local', async () => {
    const { initializeAuth, logout } = await import('../src/auth.js')
    await initializeAuth()
    await logout()
    expect(state.account.logout).toHaveBeenCalledWith({
      redirectUri: `${window.location.origin}/`,
    })
  })
})

it('não permite logout antes de iniciar o cliente', async () => {
  const { logout } = await import('../src/auth.js')
  await expect(logout()).rejects.toThrow('não foi inicializado')
})
it('mostra indisponibilidade sem tentar autenticação quando falta o endereço do login', async () => {
  config.keycloakUrl = ''
  const { initializeAuth } = await import('../src/auth.js')
  expect(await initializeAuth()).toEqual({ available: false })
})
it('falha claramente quando a configuração não pode ser lida', async () => {
  fetchMock.mockResolvedValue(new Response(null, { status: 503 }))
  const { initializeAuth } = await import('../src/auth.js')
  await expect(initializeAuth()).rejects.toThrow(
    'Configuração de autenticação indisponível',
  )
})
it('rejeita serviços desconhecidos, caminho relativo e token vazio após renovação', async () => {
  const { apiFetch } = await import('../src/auth.js')
  await expect(apiFetch('outro', '/v1/obras')).rejects.toThrow(
    'Caminho de API inválido',
  )
  await expect(apiFetch('acervo', 'relativo')).rejects.toThrow(
    'Caminho de API inválido',
  )
  state.account.updateToken.mockImplementation(async () => {
    state.account.token = ''
  })
  await expect(apiFetch('acervo', '/v1/obras')).rejects.toThrow('Faça login')
})
