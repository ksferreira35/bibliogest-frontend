export const coverFallback = '/capa-padrao.svg'

export function display(value) {
  return typeof value === 'string' ? value : value?.nome || value?.titulo || '—'
}

export function authorNames(authors) {
  return Array.isArray(authors)
    ? authors.map(display).join(', ')
    : display(authors)
}

export function matchesBook(book, query, category) {
  const text = `${book.titulo || ''} ${authorNames(book.autor)} ${display(book.categoria)} ${book.isbn || ''}`
  return (
    text
      .toLocaleLowerCase('pt-BR')
      .includes(query.trim().toLocaleLowerCase('pt-BR')) &&
    (category === 'Todas as categorias' || display(book.categoria) === category)
  )
}

export function coverUrl(book, versions = {}) {
  if (!book.capaUrl) return coverFallback
  const version = versions[book.id]
  return version
    ? `${book.capaUrl}${book.capaUrl.includes('?') ? '&' : '?'}v=${version}`
    : book.capaUrl
}

export function showFallbackCover(event) {
  if (event.currentTarget.getAttribute('src') !== coverFallback) {
    event.currentTarget.src = coverFallback
  }
}
