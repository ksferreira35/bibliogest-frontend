import Keycloak from 'keycloak-js'

let keycloak
let config
let initialization

export function initializeAuth() {
  initialization ??= initialize()
  return initialization
}

async function initialize() {
  const configPath = import.meta.env.DEV ? '/config.dev.json' : '/config.json'
  const response = await fetch(configPath, { cache: 'no-store' })
  if (!response.ok) throw new Error('Autenticação indisponível')
  config = await response.json()
  if (!config.keycloakUrl) return { available: false }
  const issuer = new URL(config.keycloakUrl)
  if (issuer.protocol !== 'https:' && issuer.hostname !== 'localhost') throw new Error('O login exige HTTPS')
  keycloak = new Keycloak({ url: config.keycloakUrl, realm: config.realm, clientId: config.clientId })
  await keycloak.init({
    onLoad: 'check-sso',
    pkceMethod: 'S256',
    checkLoginIframe: false,
    responseMode: 'query',
    redirectUri: `${window.location.origin}/`,
  })
  return { available: true, keycloak }
}

export async function apiFetch(service, path, options = {}) {
  const { public: publicRequest = false, ...fetchOptions } = options
  try {
    await initializeAuth()
  } catch (error) {
    if (!publicRequest) throw error
  }
  if (!publicRequest && !keycloak?.authenticated) throw new Error('Faça login para continuar.')
  const base = { acervo: config.acervoUrl, reservas: config.reservasUrl }[service]
  if (!base || !path.startsWith('/') || path.startsWith('//')) throw new Error('Caminho de API inválido.')
  const baseUrl = new URL(`${base}/`, window.location.origin)
  const url = new URL(path.slice(1), baseUrl)
  if (url.origin !== window.location.origin || !url.pathname.startsWith(baseUrl.pathname)) throw new Error('Caminho de API inválido.')

  const headers = new Headers(fetchOptions.headers)
  if (keycloak?.authenticated) {
    try {
      await keycloak.updateToken(30)
    } catch {
      keycloak.clearToken()
      throw new Error('Sua sessão expirou. Entre novamente.')
    }
    headers.set('Authorization', `Bearer ${keycloak.token}`)
  }
  return fetch(url, { ...fetchOptions, headers, redirect: 'error' })
}
