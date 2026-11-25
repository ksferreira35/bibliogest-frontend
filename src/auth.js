import Keycloak from 'keycloak-js'

let keycloak
let config
let initialization

// A inicialização fica fora do ciclo de renderização do React/StrictMode.
export function initializeAuth() {
  initialization ??= initialize()
  return initialization
}

export function appRedirectUri() {
  return `${window.location.origin}/`
}

export function logout() {
  if (!keycloak)
    return Promise.reject(new Error('Keycloak não foi inicializado'))
  return keycloak.logout({
    redirectUri: config?.logoutRedirectUri || appRedirectUri(),
  })
}

async function initialize() {
  const configPath = import.meta.env.DEV ? '/config.dev.json' : '/config.json'
  const response = await fetch(configPath, { cache: 'no-store' })
  if (!response.ok) throw new Error('Configuração de autenticação indisponível')
  config = await response.json()
  if (!config.keycloakUrl) return { available: false }
  const issuer = new URL(config.keycloakUrl)
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(issuer.hostname)
  if (issuer.protocol !== 'https:' && !(issuer.protocol === 'http:' && local)) {
    throw new Error('O login exige HTTPS')
  }
  keycloak = new Keycloak({
    url: config.keycloakUrl,
    realm: config.realm,
    clientId: config.clientId,
  })
  await keycloak.init({
    onLoad: 'check-sso',
    pkceMethod: 'S256',
    checkLoginIframe: false,
    responseMode: 'query',
    redirectUri: appRedirectUri(),
  })
  return { available: true, keycloak }
}

export async function apiFetch(service, path, options = {}) {
  await initializeAuth()
  if (!keycloak?.authenticated) throw new Error('Faça login para continuar')
  const base = { acervo: config.acervoUrl, reservas: config.reservasUrl }[
    service
  ]
  if (!base || !path.startsWith('/') || path.startsWith('//')) {
    throw new Error('Caminho de API inválido')
  }
  const baseUrl = new URL(`${base}/`, window.location.origin)
  const url = new URL(path.slice(1), baseUrl)
  if (
    url.origin !== window.location.origin ||
    !url.pathname.startsWith(baseUrl.pathname)
  ) {
    throw new Error('Caminho de API inválido')
  }
  // O adapter mantém os tokens somente em memória e renova antes das chamadas.
  try {
    await keycloak.updateToken(30)
  } catch {
    keycloak.clearToken()
    throw new Error('Sua sessão expirou. Entre novamente.')
  }
  if (!keycloak.authenticated || !keycloak.token)
    throw new Error('Faça login para continuar')
  const headers = new Headers(options.headers)
  headers.set('Authorization', `Bearer ${keycloak.token}`)
  return fetch(url, {
    ...options,
    headers,
    cache: options.cache || 'no-store',
    redirect: 'error',
  })
}

export function subscribeToSession(account, notify) {
  if (!account) return () => {}
  const events = [
    'onAuthSuccess',
    'onAuthRefreshSuccess',
    'onAuthLogout',
    'onAuthRefreshError',
  ]
  const handlers = events.map((event) => {
    const previous = account[event]
    const handler = (...args) => {
      try {
        previous?.(...args)
      } finally {
        notify()
      }
    }
    account[event] = handler
    return { event, previous, handler }
  })
  return () => {
    for (const { event, previous, handler } of handlers) {
      if (account[event] === handler) account[event] = previous
    }
  }
}
