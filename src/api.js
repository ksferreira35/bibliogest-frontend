import { apiFetch } from './auth.js'

async function request(service, path, options) {
  const response = await apiFetch(service, path, options)
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || `Falha na API (${response.status}).`)
  return payload
}

export async function searchBooks(query = '') {
  const params = new URLSearchParams()
  if (query.trim()) params.set('q', query.trim())
  return request('acervo', `/books${params.size ? `?${params}` : ''}`, { public: true })
}

export async function getBookDetails(key) {
  const params = new URLSearchParams({ key })
  return request('acervo', `/books/details?${params}`, { public: true })
}

export async function createBook(book) {
  return request('acervo', '/books', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(book) })
}

export async function getReservations() {
  return request('reservas', '/reservations')
}

export async function getProfile() {
  return request('acervo', '/me')
}

export async function createReservation(book) {
  return request('reservas', '/reservations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bookKey: book.key }) })
}

export async function updateReservation(id, status) {
  return request('reservas', `/reservations/${encodeURIComponent(id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
}

export function subscribeToChanges(onChange) {
  const controller = new AbortController()
  void (async () => {
    try {
      const response = await apiFetch('acervo', '/events', { signal: controller.signal })
      if (!response.ok || !response.body) return
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      while (!controller.signal.aborted) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const events = buffer.split('\n\n')
        buffer = events.pop() || ''
        for (const event of events) {
          const line = event.split('\n').find((part) => part.startsWith('data: '))
          if (line) onChange(JSON.parse(line.slice(6)))
        }
      }
    } catch (error) {
      if (error.name !== 'AbortError') console.warn('Atualização em tempo real indisponível.', error)
    }
  })()
  return () => controller.abort()
}
