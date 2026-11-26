import { useCallback, useEffect, useRef, useState } from 'react'
import { apiFetch, appRedirectUri, logout as logoutAuth } from './auth.js'
import {
  authorNames,
  coverUrl,
  display,
  showFallbackCover,
} from './domain/catalog.js'
import {
  attachBooks,
  emptyReservationView,
  normalizeReservationStatus,
  reservationPageSize,
  reservationState,
  reservationStatusLabel,
  reservationStatusValue,
} from './domain/reservations.js'
import { useSession } from './hooks/useSession.js'
import ReservationPagination from './components/ReservationPagination.jsx'
import {
  ReservationDetails,
  ReservationList,
} from './components/Reservations.jsx'
import BookForm from './components/BookForm.jsx'
import Icon from './components/Icon.jsx'
import CatalogPagination from './components/CatalogPagination.jsx'
import UsersPanel from './components/UsersPanel.jsx'
import Accessibility from './components/Accessibility.jsx'
import Modal from './components/Modal.jsx'
import './App.css'

function asList(value) {
  if (!Array.isArray(value))
    throw new Error('A API retornou uma lista em formato inválido.')
  return value
}
const copyId = (copy) => copy?.exemplarId
function availableCopies(value) {
  return Array.isArray(value?.exemplares)
    ? value.exemplares.filter((copy) => copy.disponivel === true)
    : null
}

async function request(service, path, options) {
  const response = await apiFetch(service, path, options)
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    let message = detail
    try {
      const problem = JSON.parse(detail)
      const errors = problem.errors
        ?.map((item) => `${item.field}: ${item.message}`)
        .join('; ')
      message =
        errors || problem.detail || problem.message || problem.title || detail
    } catch {
      /* O servidor também pode retornar texto simples. */
    }
    throw new Error(message || `A solicitação falhou (${response.status}).`)
  }
  if (response.status === 204) return null
  const type = response.headers.get('content-type') || ''
  return type.includes('json') ? response.json() : response.text()
}

function App({ auth }) {
  const session = useSession(auth?.keycloak)
  const identity = `${session.subject}:${session.signedIn}:${session.reader}:${session.librarian}:${session.administrator}`
  return (
    <>
      <a className="skip-link" href="#conteudo">
        Pular para o conteúdo
      </a>
      <Workspace key={identity} auth={auth} session={session} />
      <Accessibility />
    </>
  )
}

function Workspace({ auth, session }) {
  const account = auth?.keycloak
  const signedIn = session.signedIn
  const librarian = session.librarian
  const canRead = session.reader || librarian
  const authorized = canRead || session.administrator
  const user = session.name
  const [page, setPage] = useState(
    session.administrator && !session.reader && !librarian
      ? 'usuarios'
      : 'catalogo',
  )
  const [books, setBooks] = useState([])
  const [bookCache, setBookCache] = useState({})
  const [catalogQuery, setCatalogQuery] = useState({
    pagina: 0,
    tamanho: 12,
    busca: '',
    categoriaId: '',
  })
  const [catalogInfo, setCatalogInfo] = useState({
    totalElementos: 0,
    totalPaginas: 0,
    pagina: 0,
  })
  const catalogRequest = useRef(0)
  const [reservationViews, setReservationViews] = useState(() => ({
    mine: emptyReservationView(),
    desk: emptyReservationView(),
  }))
  const reservationRequests = useRef({ mine: 0, desk: 0 })
  const reservationPages = useRef({ mine: 0, desk: 0 })
  const availabilityRequest = useRef(null)
  const [coverVersions, setCoverVersions] = useState({})
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [catalogError, setCatalogError] = useState('')
  const viewKey = page === 'balcao' ? 'desk' : 'mine'
  const reservationView = reservationViews[viewKey]
  const reservations = attachBooks(
    reservationView.items,
    Object.values(bookCache),
    session,
  )
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [categories, setCategories] = useState([])
  const [authors, setAuthors] = useState([])
  const [availability, setAvailability] = useState([])
  const [availabilityLoading, setAvailabilityLoading] = useState(false)
  const [availabilityError, setAvailabilityError] = useState('')
  const [availabilityDiagnostic, setAvailabilityDiagnostic] = useState('')
  const [selectedCopies, setSelectedCopies] = useState(null)
  const [selectedReservation, setSelectedReservation] = useState(null)
  const [copyCode, setCopyCode] = useState('')
  const [selectedBook, setSelectedBook] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editingBook, setEditingBook] = useState(null)
  const [deletingBook, setDeletingBook] = useState(null)
  const [deleteError, setDeleteError] = useState('')

  const cacheBooks = useCallback((items) => {
    setBookCache((previous) => ({
      ...previous,
      ...Object.fromEntries(items.map((item) => [item.id, item])),
    }))
  }, [])
  const cancelCatalog = useCallback(() => {
    catalogRequest.current++
  }, [])
  const loadBooks = useCallback(async () => {
    const requestId = ++catalogRequest.current
    setCatalogLoading(true)
    try {
      const params = new URLSearchParams({
        pagina: catalogQuery.pagina,
        tamanho: catalogQuery.tamanho,
      })
      if (catalogQuery.busca) params.set('busca', catalogQuery.busca)
      if (catalogQuery.categoriaId)
        params.set('categoriaId', catalogQuery.categoriaId)
      const data = await request('acervo', `/v1/obras?${params}`)
      if (requestId !== catalogRequest.current) return
      // Compatibilidade durante a troca da versão publicada da API.
      const result = Array.isArray(data)
        ? {
            content: data,
            pagina: 0,
            totalElementos: data.length,
            totalPaginas: data.length ? 1 : 0,
          }
        : data
      const items = asList(result.content)
      if (
        !items.length &&
        result.totalElementos > 0 &&
        catalogQuery.pagina > 0
      ) {
        setCatalogQuery((current) => ({
          ...current,
          pagina: Math.max(0, result.totalPaginas - 1),
        }))
        return
      }
      setBooks(items)
      cacheBooks(items)
      setCatalogInfo(result)
      setCatalogError('')
    } catch (failure) {
      if (requestId === catalogRequest.current) setCatalogError(failure.message)
      throw failure
    } finally {
      if (requestId === catalogRequest.current) setCatalogLoading(false)
    }
  }, [catalogQuery, cacheBooks])
  const loadReservations = useCallback(
    async function loadPage(all = false, requestedPage) {
      if (all && !librarian)
        throw new Error('Acesso exclusivo do bibliotecário.')
      const scope = all ? 'desk' : 'mine'
      const number = requestedPage ?? reservationPages.current[scope]
      const requestId = ++reservationRequests.current[scope]
      const endpoint = all ? '/v1/reservas' : '/v1/reservas/minhas'
      const data = await request(
        'reservas',
        `${endpoint}?pagina=${number}&tamanho=${reservationPageSize}`,
      )
      if (requestId !== reservationRequests.current[scope]) return
      const items = asList(data)
      if (!items.length && number > 0) {
        if (number > reservationPages.current[scope]) {
          setReservationViews((current) => ({
            ...current,
            [scope]: { ...current[scope], hasNext: false },
          }))
          return
        }
        return loadPage(all, number - 1)
      }
      const missing = [...new Set(items.map((item) => item.obraId))].filter(
        (id) => id && !bookCache[id],
      )
      if (missing.length) {
        const summaries = await request(
          'acervo',
          `/v1/obras/resumo?ids=${missing.map(encodeURIComponent).join(',')}`,
        )
        if (requestId !== reservationRequests.current[scope]) return
        cacheBooks(asList(summaries))
      }
      reservationPages.current[scope] = number
      setReservationViews((current) => ({
        ...current,
        [scope]: {
          items,
          page: number,
          hasNext: items.length === reservationPageSize,
        },
      }))
    },
    [librarian, bookCache, cacheBooks],
  )
  const run = useCallback(async (action, successMessage) => {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await action()
      if (successMessage) setNotice(successMessage)
    } catch (failure) {
      setError(failure.message || 'Não foi possível concluir a operação.')
    } finally {
      setBusy(false)
    }
  }, [])

  useEffect(() => {
    if (!signedIn || !canRead) return undefined
    let active = true
    Promise.resolve()
      .then(() => {
        if (active) return loadBooks()
      })
      .catch(() => {})
    return () => {
      active = false
      cancelCatalog()
    }
  }, [signedIn, canRead, loadBooks, cancelCatalog])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setCatalogQuery((current) =>
        current.busca === query.trim()
          ? current
          : { ...current, busca: query.trim(), pagina: 0 },
      )
    }, 300)
    return () => window.clearTimeout(timer)
  }, [query])

  useEffect(() => {
    if (!signedIn || !canRead) return undefined
    let active = true
    request('acervo', '/v1/categorias')
      .then((data) => {
        if (active) setCategories(asList(data))
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [signedIn, canRead])

  useEffect(() => {
    if (!signedIn || !canRead || page !== 'reservas') return undefined
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible')
        loadReservations(false).catch(() => {})
    }, 5000)
    return () => window.clearInterval(timer)
  }, [signedIn, canRead, page, loadReservations])

  useEffect(() => () => availabilityRequest.current?.abort(), [])

  const filteredBooks = books
  const catalogControls = (
    <section className="catalog-controls">
      <label className="search-box">
        <Icon>search</Icon>
        <input
          value={query}
          maxLength={100}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Buscar no catálogo"
          placeholder="Busque por título, autor ou ISBN"
        />
      </label>
      <select
        value={categoryFilter}
        onChange={(event) => {
          const id = event.target.value
          setCategoryFilter(id)
          setCatalogQuery((current) => ({
            ...current,
            categoriaId: id,
            pagina: 0,
          }))
        }}
        aria-label="Filtrar por categoria"
      >
        <option value="">Todas as categorias</option>
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.nome}
          </option>
        ))}
      </select>
      <span className="result-count">
        {catalogInfo.totalElementos}{' '}
        {catalogInfo.totalElementos === 1 ? 'OBRA' : 'OBRAS'}
      </span>
    </section>
  )
  const catalogPagination = (
    <CatalogPagination
      info={catalogInfo}
      size={catalogQuery.tamanho}
      busy={catalogLoading || busy}
      onChange={(pagina) =>
        setCatalogQuery((current) => ({ ...current, pagina }))
      }
      onSize={(tamanho) =>
        setCatalogQuery((current) => ({ ...current, tamanho, pagina: 0 }))
      }
    />
  )

  async function openBookForm(book = null) {
    if (!librarian) return
    await run(async () => {
      await loadManageData()
      setEditingBook(book)
      setFormOpen(true)
    })
  }

  async function deleteBook() {
    if (!librarian || !deletingBook || busy) return
    setDeleteError('')
    await run(async () => {
      try {
        await request(
          'acervo',
          `/v1/obras/${encodeURIComponent(deletingBook.id)}`,
          { method: 'DELETE' },
        )
        setBookCache((current) => {
          const next = { ...current }
          delete next[deletingBook.id]
          return next
        })
        setDeletingBook(null)
        await loadBooks()
      } catch (failure) {
        setDeleteError(failure.message)
        throw failure
      }
    }, 'Obra excluída do Acervo.')
  }

  function closeBook() {
    availabilityRequest.current?.abort()
    setSelectedBook(null)
  }

  async function openReserve(book) {
    availabilityRequest.current?.abort()
    const controller = new AbortController()
    availabilityRequest.current = controller
    setSelectedBook({ ...book, details: false })
    setAvailability([])
    setError('')
    setAvailabilityError('')
    setAvailabilityDiagnostic('')
    setAvailabilityLoading(true)
    try {
      const response = await request(
        'reservas',
        `/v1/obras/${encodeURIComponent(book.id)}/disponibilidade`,
        { signal: controller.signal },
      )
      if (controller.signal.aborted) return
      const copies = availableCopies(response)
      if (copies === null)
        throw new Error(
          'A resposta da API de Reservas não contém a lista de exemplares disponíveis.',
        )
      setAvailability(copies)
      if (copies.length === 0) {
        try {
          const acervoCopies = asList(
            await request(
              'acervo',
              `/v1/obras/${encodeURIComponent(book.id)}/exemplares`,
              { signal: controller.signal },
            ),
          )
          if (controller.signal.aborted) return
          setAvailabilityDiagnostic(
            acervoCopies.length
              ? 'Todos os exemplares desta obra estão reservados ou emprestados.'
              : 'Esta obra não tem exemplares cadastrados no Acervo.',
          )
        } catch {
          /* A consulta de diagnóstico não altera a disponibilidade oficial. */
        }
      }
    } catch (failure) {
      if (!controller.signal.aborted)
        setAvailabilityError(
          failure.message || 'Não foi possível consultar os exemplares livres.',
        )
    } finally {
      if (!controller.signal.aborted) setAvailabilityLoading(false)
    }
  }

  async function reserve(exemplar) {
    if (!session.reader) return
    await run(async () => {
      await request('reservas', '/v1/reservas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          obraId: selectedBook.id,
          exemplarId: copyId(exemplar),
        }),
      })
      closeBook()
      await loadReservations(false, 0)
    }, 'Reserva criada. Você pode acompanhar o status em Minhas reservas.')
  }

  async function loadManageData() {
    if (!librarian) throw new Error('Acesso exclusivo do bibliotecário.')
    const [categoryData, authorData] = await Promise.all([
      request('acervo', '/v1/categorias'),
      request('acervo', '/v1/autores'),
    ])
    setCategories(asList(categoryData))
    setAuthors(asList(authorData))
  }

  async function openCopies(book) {
    if (!librarian) return
    await run(async () => {
      const data = await request(
        'acervo',
        `/v1/obras/${encodeURIComponent(book.id)}/exemplares`,
      )
      setSelectedCopies({ book, copies: asList(data) })
    })
  }

  async function createSupportRecord(service, path, name) {
    if (!librarian) throw new Error('Acesso exclusivo do bibliotecário.')
    const data = await request(service, path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome: name }),
    })
    await loadManageData()
    return data
  }

  async function doReservationAction(id, action, label) {
    if (action !== 'cancelar' && !librarian) return
    await run(async () => {
      const detail = await request(
        'reservas',
        `/v1/reservas/${encodeURIComponent(id)}`,
      )
      const currentStatus = normalizeReservationStatus(
        reservationStatusValue(detail),
      )
      const currentState = reservationState(currentStatus)
      const requiredState =
        action === 'retirada' || action === 'cancelar' ? 'waiting' : 'picked-up'
      if (currentState !== requiredState) {
        await loadReservations(page === 'balcao')
        const currentLabel = reservationStatusLabel(currentStatus, currentState)
        throw new Error(
          `A reserva está como “${currentLabel}”. Atualizei a lista; confira o status antes de continuar.`,
        )
      }
      await request(
        'reservas',
        `/v1/reservas/${encodeURIComponent(id)}/${action}`,
        { method: 'POST' },
      )
      await loadReservations(page === 'balcao')
    }, `${label} registrada.`)
  }

  async function openReservationDetails(id) {
    await run(async () => {
      const response = await request(
        'reservas',
        `/v1/reservas/${encodeURIComponent(id)}`,
      )
      const detail = response
      const row = reservations.find(
        (item) => String(item.id ?? item.reservaId) === String(id),
      )
      setSelectedReservation(
        attachBooks(
          [{ ...row, ...detail }],
          Object.values(bookCache),
          session,
        )[0],
      )
    })
  }

  function signIn() {
    account?.login({ redirectUri: appRedirectUri() })
  }
  function signOut() {
    logoutAuth().catch((failure) => setError(failure.message))
  }

  if (!signedIn)
    return (
      <main id="conteudo" tabIndex={-1} className="login-shell grid min-h-screen">
        <div className="login-art">
          <span className="eyebrow">BIBLIOGEST · CEUB</span>
          <div className="login-quote">
            <span className="quote-mark">“</span>
            <h1>Há mundos inteiros entre as páginas.</h1>
            <p>Seu próximo capítulo começa no acervo.</p>
          </div>
          <div className="login-foot">
            ACERVO ACADÊMICO <span>·</span> CONSULTA E CIRCULAÇÃO
          </div>
        </div>
        <section className="login-panel card-panel">
          <div className="login-brand flex items-center gap-4">
            <span className="ceub-logo">
              <img src="/ceub-logo.webp" alt="CEUB" />
            </span>
            <div>
              <strong>BiblioGest</strong>
              <small>BIBLIOTECA UNIVERSITÁRIA</small>
            </div>
          </div>
          <span className="eyebrow">BEM-VINDO À BIBLIOTECA</span>
          <h2>Entre na sua conta</h2>
          <p>
            Use sua conta institucional para consultar o acervo e acompanhar
            suas reservas.
          </p>
          <button
            className="button btn btn-filled primary login-button"
            onClick={signIn}
            disabled={!auth?.available}
          >
            Entrar com a conta institucional <Icon>arrow_forward</Icon>
          </button>
          <button
            className="register-link"
            onClick={() => account?.register({ redirectUri: appRedirectUri() })}
            disabled={!auth?.available}
          >
            Primeiro acesso? <strong>Crie sua conta</strong>
          </button>
          {!auth?.available && (
            <p className="inline-error">
              O acesso à conta está indisponível. Tente novamente mais tarde.
            </p>
          )}
          <div className="login-security">
            <Icon>lock</Icon> Acesso seguro à biblioteca
          </div>
          <span className="login-version">
            BIBLIOGEST · PROJETO ACADÊMICO CEUB
          </span>
        </section>
      </main>
    )

  if (!authorized)
    return (
      <main id="conteudo" tabIndex={-1} className="empty-state" role="alert">
        <h1>Acesso não autorizado</h1>
        <p>Sua conta não possui um perfil de acesso à biblioteca.</p>
        <button className="button btn btn-outlined secondary" onClick={signOut}>
          Sair da conta
        </button>
      </main>
    )

  const nav = [
    ...(canRead
      ? [
          ['catalogo', 'Catálogo', 'menu_book'],
          ['reservas', 'Minhas reservas', 'bookmark'],
        ]
      : []),
  ]
  if (librarian)
    nav.push(
      ['gestao', 'Gestão do acervo', 'library_books'],
      ['balcao', 'Balcão', 'sync_alt'],
    )

  if (session.administrator) nav.push(['usuarios', 'Usuários', 'library_books'])

  return (
    <div className="app-shell min-h-screen flex flex-col">
      <header className="topbar">
        <button
          className="brand"
          onClick={() => setPage(canRead ? 'catalogo' : 'usuarios')}
        >
          <span className="ceub-logo">
            <img src="/ceub-logo.webp" alt="CEUB" />
          </span>
          <span>
            <strong>BiblioGest</strong>
            <small>BIBLIOTECA CEUB</small>
          </span>
        </button>
        <nav className="main-nav" aria-label="Navegação principal">
          {nav.map(([id, label, icon]) => (
            <button
              key={id}
              className={page === id ? 'active' : ''}
              aria-current={page === id ? 'page' : undefined}
              onClick={() => {
                if (id === 'usuarios' && !session.administrator) return
                if ((id === 'gestao' || id === 'balcao') && !librarian) return
                setPage(id)
                setError('')
                if (id === 'reservas' || id === 'balcao')
                  run(() => loadReservations(id === 'balcao'))
                if (id === 'gestao') run(loadManageData)
              }}
            >
              <Icon>{icon}</Icon>
              {label}
            </button>
          ))}
        </nav>
        <div className="account">
          <div className="avatar">{user.slice(0, 1).toUpperCase()}</div>
          <div className="account-label">
            <strong>{user}</strong>
            <small>
              {session.administrator
                ? 'ADMINISTRADOR'
                : librarian
                  ? 'BIBLIOTECÁRIO'
                  : 'LEITOR'}
            </small>
          </div>
          <button
            className="icon-button"
            onClick={signOut}
            aria-label="Sair"
            title="Sair"
          >
            <Icon>logout</Icon>
            <span>Sair</span>
          </button>
        </div>
      </header>
      <main id="conteudo" tabIndex={-1} className="content w-full flex-1">
        {error && (
          <div className="feedback-toast error" role="alert">
            <Icon>error</Icon>
            {error}
            <button onClick={() => setError('')} aria-label="Fechar">
              ×
            </button>
          </div>
        )}
        {notice && (
          <div className="feedback-toast success" role="status">
            <Icon>check_circle</Icon>
            {notice}
            <button onClick={() => setNotice('')} aria-label="Fechar">
              ×
            </button>
          </div>
        )}

        {page === 'usuarios' && session.administrator && (
          <UsersPanel subject={session.subject} />
        )}
        {page === 'catalogo' && (
          <>
            <section className="catalog-hero">
              <div>
                <span className="eyebrow">
                  CONSULTA CATALOGRÁFICA · ACERVO FÍSICO
                </span>
                <h1>
                  Histórias esperando
                  <br />
                  <em>por você.</em>
                </h1>
                <p>
                  Explore o acervo da biblioteca e encontre sua próxima leitura.
                </p>
              </div>
              <div className="hero-note">
                <span>ACERVO VIVO</span>
                <strong>{`${catalogInfo.totalElementos} obras`}</strong>
                <small>ATUALIZADO DIRETO DO ACERVO</small>
              </div>
            </section>
            {catalogControls}
            {catalogLoading ? (
              <div className="empty-state">
                <Icon>menu_book</Icon>
                <h2>O catálogo está carregando</h2>
                <p>As obras serão exibidas assim que o Acervo responder.</p>
                <button
                  className="button btn btn-outlined secondary"
                  onClick={() => run(loadBooks)}
                >
                  Tentar novamente
                </button>
              </div>
            ) : catalogError ? (
              <div className="empty-state">
                <h2>Não foi possível carregar o catálogo</h2>
                <p>{catalogError}</p>
                <button
                  className="button btn btn-outlined secondary"
                  disabled={busy}
                  onClick={() => run(loadBooks)}
                >
                  Tentar novamente
                </button>
              </div>
            ) : filteredBooks.length === 0 ? (
              <div className="empty-state">
                <h2>
                  {catalogQuery.busca || catalogQuery.categoriaId
                    ? 'Nenhuma obra encontrada'
                    : 'Nenhuma obra cadastrada'}
                </h2>
                <p>
                  {catalogQuery.busca || catalogQuery.categoriaId
                    ? 'Tente outro título, autor, ISBN ou categoria.'
                    : 'O catálogo será exibido quando as obras forem cadastradas.'}
                </p>
              </div>
            ) : (
              <div className="book-grid grid grid-cols-2 min-[601px]:grid-cols-3 min-[901px]:grid-cols-4 gap-x-4 gap-y-6 md:gap-x-6 md:gap-y-8">
                {filteredBooks.map((book) => (
                  <article className="book-card card flex flex-col" key={book.id}>
                    <button
                      className="cover-button"
                      onClick={() =>
                        setSelectedBook({ ...book, details: true })
                      }
                      aria-label={`Ver detalhes de ${book.titulo}`}
                    >
                      <img
                        className="book-cover"
                        src={coverUrl(book, coverVersions)}
                        alt={`Capa de ${book.titulo}`}
                        onError={showFallbackCover}
                      />
                      <span className="cover-tag">ACERVO</span>
                    </button>
                    <div className="book-meta flex flex-col flex-1">
                      <span className="category-label">
                        {display(book.categoria)}
                      </span>
                      <h2>{book.titulo}</h2>
                      <p>{authorNames(book.autor)}</p>
                      <div className="book-info">
                        {book.volume
                          ? `Vol. ${book.volume}`
                          : 'Exemplar físico'}
                        {book.isbn ? ` · ISBN ${book.isbn}` : ''}
                      </div>
                      <button
                        className="button btn btn-tonal reserve-button"
                        onClick={() => openReserve(book)}
                        disabled={busy}
                      >
                        Consultar disponibilidade <Icon>arrow_forward</Icon>
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
            {!catalogError && catalogPagination}
          </>
        )}

        {page === 'reservas' && (
          <>
            <PageHeading
              kicker="ÁREA DO LEITOR · CIRCULAÇÃO"
              title="Minhas reservas"
              description="Acompanhe os exemplares aguardando retirada e seu histórico de circulação."
            />
            <div className="section-bar">
              <span>{reservations.length} RESERVAS NESTA PÁGINA</span>
              <button
                className="button btn btn-outlined secondary"
                onClick={() => run(() => loadReservations(false))}
                disabled={busy}
              >
                <Icon>refresh</Icon> Atualizar
              </button>
            </div>
            <ReservationList
              busy={busy}
              reservations={reservations}
              onCancel={(id) =>
                doReservationAction(id, 'cancelar', 'Cancelamento')
              }
              onOpen={openReservationDetails}
            />
            <ReservationPagination
              view={reservationView}
              busy={busy}
              onChange={(number) => run(() => loadReservations(false, number))}
            />
          </>
        )}

        {librarian && page === 'gestao' && (
          <>
            <PageHeading
              kicker="BIBLIOTECÁRIO · CURADORIA TÉCNICA"
              title="Gestão do acervo"
              description="Cadastre, edite e organize as obras do Acervo institucional."
            />
            <div className="section-bar">
              <span>{catalogInfo.totalElementos} OBRAS ENCONTRADAS</span>
              <button
                className="button btn btn-filled primary"
                disabled={busy}
                onClick={() => openBookForm()}
              >
                <Icon>add</Icon> Cadastrar obra
              </button>
            </div>
            {catalogControls}
            {catalogError && (
              <p role="alert">
                {catalogError}
                <button
                  className="button btn btn-outlined secondary"
                  onClick={() => run(loadBooks)}
                >
                  Tentar novamente
                </button>
              </p>
            )}
            {catalogLoading ? (
              <p role="status">Carregando obras…</p>
            ) : (
              <div className="manage-list">
                {books.map((book) => (
                  <article key={book.id} className="manage-row">
                    <img
                      src={coverUrl(book, coverVersions)}
                      alt={`Capa de ${book.titulo}`}
                      onError={showFallbackCover}
                    />
                    <div>
                      <strong>{book.titulo}</strong>
                      <small>
                        {authorNames(book.autor)} · {display(book.categoria)}
                      </small>
                    </div>
                    <span>#{book.id}</span>
                    <div className="manage-actions">
                      <button
                        className="upload-button"
                        disabled={busy}
                        onClick={() => openBookForm(book)}
                      >
                        Editar
                      </button>
                      <button
                        className="upload-button danger-button"
                        disabled={busy}
                        onClick={() => {
                          setDeleteError('')
                          setDeletingBook(book)
                        }}
                      >
                        Excluir
                      </button>
                      <button
                        className="upload-button"
                        disabled={busy}
                        onClick={() => openCopies(book)}
                      >
                        Exemplares
                      </button>
                      <label className="upload-button">
                        Enviar capa
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(event) => {
                            const file = event.target.files?.[0]
                            if (!file) return
                            const data = new FormData()
                            data.append('arquivo', file)
                            run(async () => {
                              await request(
                                'acervo',
                                `/v1/obras/${encodeURIComponent(book.id)}/capa`,
                                { method: 'PUT', body: data },
                              )
                              setCoverVersions((current) => ({
                                ...current,
                                [book.id]: Date.now(),
                              }))
                              await loadBooks()
                            }, 'Capa atualizada no Acervo.')
                          }}
                        />
                      </label>
                    </div>
                  </article>
                ))}
                {!books.length && !catalogError && (
                  <p>Nenhuma obra encontrada.</p>
                )}
              </div>
            )}
            {!catalogError && catalogPagination}
            {formOpen && (
              <BookForm
                key={editingBook?.id || 'new'}
                book={editingBook}
                categories={categories}
                authors={authors}
                busy={busy}
                onClose={() => setFormOpen(false)}
                onCreateSupport={createSupportRecord}
                onSubmit={(payload) =>
                  run(
                    async () => {
                      if (!librarian) return
                      const saved = await request(
                        'acervo',
                        editingBook
                          ? `/v1/obras/${encodeURIComponent(editingBook.id)}`
                          : '/v1/obras',
                        {
                          method: editingBook ? 'PUT' : 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify(payload),
                        },
                      )
                      cacheBooks([saved])
                      setFormOpen(false)
                      await loadBooks()
                    },
                    editingBook
                      ? 'Obra atualizada no Acervo.'
                      : 'Obra cadastrada no Acervo.',
                  )
                }
              />
            )}
          </>
        )}

        {librarian && page === 'balcao' && (
          <>
            <PageHeading
              kicker="BIBLIOTECÁRIO · CIRCULAÇÃO"
              title="Balcão de retiradas"
              description="Registre a entrega e a devolução de exemplares reservados."
            />
            <div className="section-bar">
              <span>{reservations.length} RESERVAS NESTA PÁGINA</span>
              <button
                className="button btn btn-outlined secondary"
                onClick={() => run(() => loadReservations(true))}
                disabled={busy}
              >
                <Icon>refresh</Icon> Sincronizar
              </button>
            </div>
            <ReservationList
              busy={busy}
              librarian
              reservations={reservations}
              onOpen={openReservationDetails}
              onPickup={(id) => doReservationAction(id, 'retirada', 'Retirada')}
              onReturn={(id, state) =>
                state === 'picked-up'
                  ? doReservationAction(id, 'devolucao', 'Devolução')
                  : setError(
                      state === 'waiting'
                        ? 'Registre a retirada antes de devolver este exemplar.'
                        : 'Esta reserva ainda não está no estado Retirado.',
                    )
              }
            />
            <ReservationPagination
              view={reservationView}
              busy={busy}
              onChange={(number) => run(() => loadReservations(true, number))}
            />
          </>
        )}
      </main>

      {librarian && deletingBook && (
        <div className="modal-scrim">
          <Modal
            className="dialog-panel"
            onClose={() => {
              if (!busy) setDeletingBook(null)
            }}
            aria-labelledby="delete-title"
          >
            <h2 id="delete-title">Excluir obra?</h2>
            <p>Deseja excluir “{deletingBook.titulo}” do Acervo?</p>
            <p>
              Obras com exemplares vinculados não podem ser excluídas. Essa
              proteção preserva os registros usados pelas reservas.
            </p>
            {deleteError && (
              <p role="alert" className="inline-error">
                {deleteError}
              </p>
            )}
            <div className="form-actions flex flex-wrap justify-end gap-3">
              <button
                className="button btn btn-outlined secondary"
                disabled={busy}
                onClick={() => setDeletingBook(null)}
              >
                Cancelar
              </button>
              <button
                className="button btn btn-filled primary danger-button"
                disabled={busy}
                onClick={deleteBook}
              >
                Confirmar exclusão
              </button>
            </div>
          </Modal>
        </div>
      )}
      {selectedBook && (
        <div
          className="modal-scrim"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeBook()
          }}
        >
          <Modal
            className="dialog-panel"
            onClose={closeBook}
            aria-labelledby="modal-title"
          >
            <button
              className="modal-close"
              onClick={() => closeBook()}
              aria-label="Fechar"
            >
              ×
            </button>
            {selectedBook.details ? (
              <>
                <span className="eyebrow">REGISTRO DO ACERVO</span>
                <h2 id="modal-title">{selectedBook.titulo}</h2>
                <p>
                  {authorNames(selectedBook.autor)} ·{' '}
                  {display(selectedBook.categoria)}
                </p>
                <section className="book-synopsis" aria-label="Sinopse">
                  <h3>Sinopse</h3>
                  <p>
                    {selectedBook.descricao || 'Sinopse ainda não cadastrada.'}
                  </p>
                </section>
                <dl className="book-details">
                  <dt>ISBN</dt>
                  <dd>{selectedBook.isbn || '—'}</dd>
                  <dt>Volume</dt>
                  <dd>{selectedBook.volume || '—'}</dd>
                </dl>
                <button
                  className="button btn btn-filled primary"
                  onClick={() => openReserve(selectedBook)}
                >
                  Consultar disponibilidade
                </button>
              </>
            ) : (
              <>
                <span className="eyebrow">RESERVA DE EXEMPLAR</span>
                <h2 id="modal-title">{selectedBook.titulo}</h2>
                <p>Escolha um exemplar livre para enviar sua reserva.</p>
                {availabilityLoading ? (
                  <div className="empty-inline">
                    Consultando a disponibilidade…
                  </div>
                ) : availabilityError ? (
                  <div className="availability-error">
                    <p>{availabilityError}</p>
                    <button
                      className="button btn btn-outlined secondary"
                      onClick={() => openReserve(selectedBook)}
                    >
                      Tentar novamente
                    </button>
                  </div>
                ) : availability.length ? (
                  <div className="availability-list">
                    {availability.map((copy) => (
                      <div key={copyId(copy)}>
                        <span>
                          <Icon>check_circle</Icon> Exemplar{' '}
                          {(typeof copy === 'object' &&
                            (copy.codigoTombo || copy.codigo || copy.tombo)) ||
                            copyId(copy)}
                        </span>
                        <button
                          className="button btn btn-filled primary"
                          onClick={() => reserve(copy)}
                          disabled={busy || !session.reader}
                        >
                          Reservar
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="availability-error">
                    <p>
                      A API de Reservas não retornou exemplares livres para esta
                      obra.
                    </p>
                    {availabilityDiagnostic && <p>{availabilityDiagnostic}</p>}
                    <button
                      className="button btn btn-outlined secondary"
                      onClick={() => openReserve(selectedBook)}
                    >
                      Consultar novamente
                    </button>
                  </div>
                )}
              </>
            )}
          </Modal>
        </div>
      )}
      {librarian && selectedCopies && (
        <div className="modal-scrim">
          <Modal
            className="dialog-panel"
            onClose={() => setSelectedCopies(null)}
            aria-labelledby="copies-title"
          >
            <button
              className="modal-close"
              onClick={() => setSelectedCopies(null)}
              aria-label="Fechar"
            >
              ×
            </button>
            <span className="eyebrow">TOMBAMENTO FÍSICO</span>
            <h2 id="copies-title">Exemplares · {selectedCopies.book.titulo}</h2>
            <div className="availability-list">
              {selectedCopies.copies.map((copy) => (
                <div key={copy.id}>
                  <span>
                    {copy.codigoTombo ||
                      copy.codigo ||
                      copy.tombo ||
                      `Exemplar ${copy.id}`}{' '}
                    · {copy.status || copy.situacao || 'Cadastrado'}
                  </span>
                </div>
              ))}
            </div>
            <form
              className="copy-form"
              onSubmit={(event) => {
                event.preventDefault()
                run(async () => {
                  await request(
                    'acervo',
                    `/v1/obras/${encodeURIComponent(selectedCopies.book.id)}/exemplares`,
                    {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ codigoTombo: copyCode }),
                    },
                  )
                  setCopyCode('')
                  const data = await request(
                    'acervo',
                    `/v1/obras/${encodeURIComponent(selectedCopies.book.id)}/exemplares`,
                  )
                  setSelectedCopies({
                    ...selectedCopies,
                    copies: asList(data),
                  })
                }, 'Exemplar cadastrado no Acervo.')
              }}
            >
              <label>
                Código do tombo
                <input
                  required
                  value={copyCode}
                  onChange={(event) => setCopyCode(event.target.value)}
                  placeholder="Código patrimonial"
                />
              </label>
              <button className="button btn btn-filled primary" disabled={busy}>
                Adicionar exemplar
              </button>
            </form>
          </Modal>
        </div>
      )}
      {selectedReservation && (
        <ReservationDetails
          reservation={selectedReservation}
          onClose={() => setSelectedReservation(null)}
        />
      )}
      <footer className="footer">
        <span>
          BIBLIOGEST <i>·</i> PROJETO ACADÊMICO CEUB
        </span>
        <span>ACERVO E CIRCULAÇÃO INSTITUCIONAL</span>
      </footer>
    </div>
  )
}

function PageHeading({ kicker, title, description }) {
  return (
    <section className="page-heading">
      <span className="eyebrow">{kicker}</span>
      <h1>{title}</h1>
      <p>{description}</p>
    </section>
  )
}

export default App
