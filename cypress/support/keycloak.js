// Adapter exclusivo do servidor Vite --mode e2e. Não é incluído no build de produção.
export default class Keycloak {
  constructor() {
    this.roles = window.__testRoles || []
    this.authenticated = this.roles.length > 0
    this.token = 'fixture-token'
    this.tokenParsed = { sub: 'fixture-reader', name: 'Pessoa de teste' }
  }
  async init() {
    return this.authenticated
  }
  hasRealmRole(role) {
    return this.roles.includes(role)
  }
  async updateToken() {
    return false
  }
  async login() {
    this.authenticated = true
    this.roles = ['LEITOR']
    this.onAuthSuccess?.()
  }
  async register() {
    return this.login()
  }
  async logout() {
    this.clearToken()
  }
  clearToken() {
    this.authenticated = false
    this.token = undefined
    this.onAuthLogout?.()
  }
}
