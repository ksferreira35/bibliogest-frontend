import { createServer } from 'node:http'
import { createPublicKey, randomUUID, verify } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createUniqueIdentifier } from './identifiers.js'
import { stockDeltaForStatusChange } from './reservations.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const dataDirectory = process.env.BIBLIOGEST_DATA_DIR || path.join(here, 'data')
const dataFile = path.join(dataDirectory, 'db.json')
const port = Number(process.env.API_PORT || 3001)
const issuer = process.env.KEYCLOAK_ISSUER || 'http://localhost:8080/realms/bibliogest'
const jwksUrl = process.env.KEYCLOAK_JWKS_URL || `${issuer}/protocol/openid-connect/certs`
const openLibraryAgent = process.env.OPENLIBRARY_USER_AGENT || (process.env.OPENLIBRARY_CONTACT ? `BiblioGest/0.1 (${process.env.OPENLIBRARY_CONTACT})` : 'BiblioGest/0.1 (local development)')
const openLibraryCache = new Map()
let lastOpenLibraryRequestAt = 0
let openLibraryQueue = Promise.resolve()
const seedBooks = [
  { id: 'bg-1', key: '/works/OL27448W', title: 'Elogio da Sombra', author: 'Junichiro Tanizaki', genre: 'Ensaio', year: 2017, copies: 3, coverId: null, source: 'bibliogest' },
  { id: 'bg-2', key: '/works/OL179567W', title: 'O Livro do Chá', author: 'Kakuzo Okakura', genre: 'Filosofia', year: 2018, copies: 2, coverId: null, source: 'bibliogest' },
  { id: 'bg-3', key: '/works/OL153699W', title: 'Coração (Kokoro)', author: 'Natsume Soseki', genre: 'Romance', year: 2020, copies: 4, coverId: null, source: 'bibliogest' },
  { id: 'bg-4', key: '/works/OL196395W', title: 'A Dança das Sombras', author: 'Yoko Ogawa', genre: 'Ficção', year: 2022, copies: 1, coverId: null, source: 'bibliogest' },
  { id: 'bg-5', key: '/works/OL178607W', title: 'Arquitetura Metabolista', author: 'Kisho Kurokawa', genre: 'Arquitetura', year: 2021, copies: 0, coverId: null, source: 'bibliogest' },
  { id: 'bg-6', key: '/works/OL200990W', title: 'Crônica dos Rios Invisíveis', author: 'Mia Couto', genre: 'Literatura', year: 2019, copies: 2, coverId: null, source: 'bibliogest' },
]

let db
let jwksCache
let jwksCacheAt = 0
const listeners = new Set()
const profileInitializations = new Map()

async function loadDb() {
  await mkdir(dataDirectory, { recursive: true })
  try {
    db = JSON.parse(await readFile(dataFile, 'utf8'))
    db.users ||= []
    db.books ||= []
    db.reservations ||= []
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
    db = { books: seedBooks, reservations: [], users: [] }
    await persist()
  }
}

async function persist() {
  const temp = `${dataFile}.tmp`
  await writeFile(temp, JSON.stringify(db, null, 2))
  await rename(temp, dataFile)
}

function send(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  response.end(JSON.stringify(body))
}

async function readBody(request) {
  let body = ''
  for await (const chunk of request) {
    body += chunk
    if (body.length > 1_000_000) throw Object.assign(new Error('Corpo da requisição muito grande'), { status: 413 })
  }
  try { return body ? JSON.parse(body) : {} } catch { throw Object.assign(new Error('JSON inválido'), { status: 400 }) }
}

async function loadJwks() {
  if (jwksCache && Date.now() - jwksCacheAt < 300_000) return jwksCache
  const response = await fetch(jwksUrl, { signal: AbortSignal.timeout(5000) })
  if (!response.ok) throw new Error(`Keycloak respondeu ${response.status} ao consultar as chaves`)
  jwksCache = await response.json()
  jwksCacheAt = Date.now()
  return jwksCache
}

async function authenticate(request) {
  const match = /^Bearer (.+)$/.exec(request.headers.authorization || '')
  if (!match) throw Object.assign(new Error('Faça login para continuar.'), { status: 401 })
  const [encodedHeader, encodedPayload, encodedSignature] = match[1].split('.')
  if (!encodedHeader || !encodedPayload || !encodedSignature) throw Object.assign(new Error('Token inválido.'), { status: 401 })
  let header, claims
  try {
    header = JSON.parse(Buffer.from(encodedHeader, 'base64url').toString('utf8'))
    claims = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'))
  } catch { throw Object.assign(new Error('Token inválido.'), { status: 401 }) }
  if (header.alg !== 'RS256' || claims.iss !== issuer || claims.azp !== 'bibliogest-react' || typeof claims.exp !== 'number' || claims.exp <= Date.now() / 1000 || (typeof claims.nbf === 'number' && claims.nbf > Date.now() / 1000)) {
    throw Object.assign(new Error('Token expirado ou emitido por uma origem não confiável.'), { status: 401 })
  }
  let jwks = await loadJwks()
  let jwk = jwks.keys.find((key) => key.kid === header.kid && key.use === 'sig')
  if (!jwk) {
    jwksCacheAt = 0
    jwks = await loadJwks()
    jwk = jwks.keys.find((key) => key.kid === header.kid && key.use === 'sig')
  }
  if (!jwk) throw Object.assign(new Error('Chave de assinatura não reconhecida.'), { status: 401 })
  const valid = verify('RSA-SHA256', Buffer.from(`${encodedHeader}.${encodedPayload}`), createPublicKey({ key: jwk, format: 'jwk' }), Buffer.from(encodedSignature, 'base64url'))
  if (!valid) throw Object.assign(new Error('Assinatura do token inválida.'), { status: 401 })
  return claims
}

function hasRole(claims, role) {
  return claims.realm_access?.roles?.includes(role) || Object.values(claims.resource_access || {}).some((client) => client.roles?.includes(role))
}

async function ensureProfile(claims) {
  let profile = db.users.find((user) => user.userId === claims.sub)
  if (profile) return profile
  if (!profileInitializations.has(claims.sub)) {
    profileInitializations.set(claims.sub, (async () => {
      const existing = db.users.find((user) => user.userId === claims.sub)
      if (existing) return existing
      const academicId = createUniqueIdentifier('ACA', db.users.map((user) => user.academicId))
      const newProfile = {
        userId: claims.sub,
        academicId,
        name: claims.name || claims.preferred_username || 'Leitor',
        email: claims.email || '',
        createdAt: new Date().toISOString(),
      }
      db.users.push(newProfile)
      await persist()
      return newProfile
    })())
  }
  try { return await profileInitializations.get(claims.sub) }
  finally { profileInitializations.delete(claims.sub) }
}

function requireLibrarian(claims) {
  if (!hasRole(claims, 'BIBLIOTECARIO')) throw Object.assign(new Error('Acesso exclusivo para bibliotecários.'), { status: 403 })
}

function broadcast(event) {
  const data = `data: ${JSON.stringify(event)}\n\n`
  for (const listener of listeners) {
    if (listener.librarian || !event.reservation || event.reservation.userId === listener.userId) listener.response.write(data)
  }
}

async function openLibrarySearch(query) {
  const cacheKey = query.toLocaleLowerCase('pt-BR')
  const cached = openLibraryCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) return cached.books
  let release
  const turn = new Promise((resolve) => { release = resolve })
  const previous = openLibraryQueue
  openLibraryQueue = previous.then(() => turn)
  await previous
  try {
    const remaining = Math.max(0, 1100 - (Date.now() - lastOpenLibraryRequestAt))
    if (remaining) await new Promise((resolve) => setTimeout(resolve, remaining))
    lastOpenLibraryRequestAt = Date.now()
  const url = new URL('https://openlibrary.org/search.json')
  url.searchParams.set('q', query)
  url.searchParams.set('lang', 'pt')
  url.searchParams.set('limit', '15')
  url.searchParams.set('fields', 'key,title,author_name,first_publish_year,cover_i,subject,edition_count')
  const response = await fetch(url, { headers: { 'User-Agent': openLibraryAgent }, signal: AbortSignal.timeout(8000) })
  if (!response.ok) throw new Error(`Open Library respondeu ${response.status}`)
  const result = await response.json()
  const books = result.docs.map((doc) => ({
    id: `ol:${doc.key}`,
    key: doc.key.startsWith('/works/') ? doc.key : `/works/${doc.key}`,
    title: doc.title,
    author: doc.author_name?.[0] || 'Autoria não informada',
    genre: doc.subject?.[0] || 'Sem categoria',
    year: doc.first_publish_year || null,
    copies: 0,
    coverId: doc.cover_i || null,
    editionCount: doc.edition_count || 0,
    source: 'openlibrary',
  }))
    if (openLibraryCache.size >= 100) openLibraryCache.delete(openLibraryCache.keys().next().value)
    openLibraryCache.set(cacheKey, { books, expiresAt: Date.now() + 15 * 60 * 1000 })
    return books
  } finally {
    release()
  }
}

const server = createServer(async (request, response) => {
  if (request.url === '/healthz') return send(response, 200, { status: 'ok' })
  if (!request.url.startsWith('/api/')) return send(response, 404, { error: 'Rota não encontrada.' })
  try {
    const url = new URL(request.url, 'http://localhost')
    const publicRead = request.method === 'GET' && ['/api/books', '/api/books/details'].includes(url.pathname)
    const claims = publicRead ? null : await authenticate(request)
    const profile = claims ? await ensureProfile(claims) : null

    if (url.pathname === '/api/events' && request.method === 'GET') {
      response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' })
      response.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`)
      const listener = { response, userId: claims.sub, librarian: hasRole(claims, 'BIBLIOTECARIO') }
      listeners.add(listener)
      response.on('close', () => listeners.delete(listener))
      return
    }

    if (url.pathname === '/api/me' && request.method === 'GET') return send(response, 200, { profile })

    if (url.pathname === '/api/books' && request.method === 'GET') {
      const query = (url.searchParams.get('q') || '').trim()
      const local = db.books.filter((book) => !query || `${book.title} ${book.author} ${book.genre}`.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR')))
      if (!query || query.length < 2) return send(response, 200, { books: local, source: 'bibliogest' })
      try {
        const external = await openLibrarySearch(query)
        const known = new Set(local.map((book) => book.key))
        return send(response, 200, { books: [...local, ...external.filter((book) => !known.has(book.key))], source: 'bibliogest+openlibrary' })
      } catch (error) {
        return send(response, 200, { books: local, source: 'bibliogest', warning: `Busca externa indisponível: ${error.message}` })
      }
    }

    if (url.pathname === '/api/books/details' && request.method === 'GET') {
      const key = url.searchParams.get('key')
      const book = db.books.find((item) => item.key === key)
      if (!key) return send(response, 400, { error: 'Identificador de obra inválido.' })
      if (book?.source === 'bibliogest') return send(response, 200, { book, details: null, source: 'bibliogest' })
      if (!/^\/works\/OL\d+W$/.test(key)) {
        if (book) return send(response, 200, { book, details: null, source: 'bibliogest' })
        return send(response, 400, { error: 'Identificador de obra inválido.' })
      }
      try {
        const result = await fetch(`https://openlibrary.org${key}.json`, { headers: { 'User-Agent': openLibraryAgent }, signal: AbortSignal.timeout(8000) })
        if (!result.ok) throw new Error(`Open Library respondeu ${result.status}`)
        const details = await result.json()
        return send(response, 200, { book, details, source: 'openlibrary' })
      } catch (error) {
        if (book) return send(response, 200, { book, details: null, warning: error.message })
        return send(response, 502, { error: `Detalhes externos indisponíveis: ${error.message}` })
      }
    }

    if (url.pathname === '/api/books' && request.method === 'POST') {
      requireLibrarian(claims)
      const body = await readBody(request)
      if (!body.title?.trim() || !body.author?.trim()) return send(response, 400, { error: 'Título e autor são obrigatórios.' })
      const book = { id: `bg-${randomUUID()}`, key: `urn:bibliogest:${randomUUID()}`, title: body.title.trim(), author: body.author.trim(), genre: body.genre?.trim() || 'Sem categoria', year: Number(body.year) || new Date().getFullYear(), copies: Math.max(0, Number(body.copies) || 0), coverId: null, source: 'bibliogest' }
      db.books.unshift(book)
      await persist()
      broadcast({ type: 'books.changed', book })
      return send(response, 201, { book })
    }

    if (url.pathname === '/api/reservations' && request.method === 'GET') {
      const reservations = hasRole(claims, 'BIBLIOTECARIO') ? db.reservations : db.reservations.filter((item) => item.userId === claims.sub)
      return send(response, 200, { reservations })
    }

    if (url.pathname === '/api/reservations' && request.method === 'POST') {
      if (hasRole(claims, 'BIBLIOTECARIO')) return send(response, 403, { error: 'Use uma conta leitora para criar reservas.' })
      const body = await readBody(request)
      const book = db.books.find((item) => item.key === body.bookKey)
      if (!book || book.copies < 1) return send(response, 409, { error: 'Não há exemplar disponível para este título no acervo local.' })
      if (db.reservations.some((item) => item.userId === claims.sub && item.bookKey === book.key && item.status !== 'Cancelada')) return send(response, 409, { error: 'Você já tem uma reserva ativa para este título.' })
      const code = createUniqueIdentifier('TMB', db.reservations.map((reservation) => reservation.code))
      const reservation = { id: randomUUID(), userId: claims.sub, academicId: profile.academicId, userName: profile.name, bookKey: book.key, title: book.title, author: book.author, code, createdAt: new Date().toISOString(), status: 'Aguardando retirada' }
      book.copies -= 1
      db.reservations.unshift(reservation)
      await persist()
      broadcast({ type: 'reservations.changed', reservation })
      return send(response, 201, { reservation })
    }

    const reservationRoute = /^\/api\/reservations\/([^/]+)$/.exec(url.pathname)
    if (reservationRoute && request.method === 'PATCH') {
      requireLibrarian(claims)
      const body = await readBody(request)
      if (!['Retirado', 'Aguardando retirada', 'Cancelada'].includes(body.status)) return send(response, 400, { error: 'Status de reserva inválido.' })
      const reservation = db.reservations.find((item) => item.id === reservationRoute[1])
      if (!reservation) return send(response, 404, { error: 'Reserva não encontrada.' })
      const stockDelta = stockDeltaForStatusChange(reservation.status, body.status)
      const book = db.books.find((item) => item.key === reservation.bookKey)
      if (stockDelta < 0 && (!book || book.copies < 1)) return send(response, 409, { error: 'Não há exemplar disponível para reabrir esta reserva.' })
      if (book) book.copies += stockDelta
      reservation.status = body.status
      reservation.updatedAt = new Date().toISOString()
      await persist()
      broadcast({ type: 'reservations.changed', reservation })
      return send(response, 200, { reservation })
    }

    return send(response, 404, { error: 'Rota não encontrada.' })
  } catch (error) {
    if (error.name === 'AbortError' || error.name === 'TimeoutError') return send(response, 504, { error: 'A API externa demorou para responder.' })
    return send(response, error.status || 500, { error: error.message || 'Erro interno da API.' })
  }
})

await loadDb()
server.listen(port, '0.0.0.0', () => console.log(`BiblioGest API disponível em http://localhost:${port}`))
