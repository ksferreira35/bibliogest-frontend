import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiFetch } from './auth.js'
import './App.css'

const asList = (value) => Array.isArray(value) ? value : value?.content || value?.items || value?.data || []
const display = (value) => typeof value === 'string' ? value : value?.nome || value?.name || value?.titulo || '—'
const copyId = (copy) => typeof copy === 'string' || typeof copy === 'number' ? copy : copy?.id ?? copy?.exemplarId
const coverFallback = 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&w=700&q=80'

async function request(service, path, options) {
  const response = await apiFetch(service, path, options)
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(detail || `A solicitação falhou (${response.status}).`)
  }
  if (response.status === 204) return null
  const type = response.headers.get('content-type') || ''
  return type.includes('json') ? response.json() : response.text()
}

function Icon({ children }) { return <span className="icon" aria-hidden="true">{children}</span> }

function App({ auth }) {
  const account = auth?.keycloak
  const signedIn = Boolean(account?.authenticated)
  const librarian = Boolean(account?.hasRealmRole?.('BIBLIOTECARIO') || account?.hasRealmRole?.('bibliotecario') || account?.hasRealmRole?.('LIBRARIAN'))
  const user = account?.tokenParsed?.name || account?.tokenParsed?.preferred_username || 'Leitor'
  const [page, setPage] = useState('catalogo')
  const [books, setBooks] = useState([])
  const [reservations, setReservations] = useState([])
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('Todas as categorias')
  const [categories, setCategories] = useState([])
  const [authors, setAuthors] = useState([])
  const [availability, setAvailability] = useState([])
  const [selectedCopies, setSelectedCopies] = useState(null)
  const [copyCode, setCopyCode] = useState('')
  const [selectedBook, setSelectedBook] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [formOpen, setFormOpen] = useState(false)

  const loadBooks = useCallback(async () => {
    const data = await request('acervo', '/v1/obras')
    setBooks(asList(data))
  }, [])
  const loadReservations = useCallback(async (all = false) => {
    const data = await request('reservas', all ? '/v1/reservas' : '/v1/reservas/minhas')
    setReservations(asList(data))
  }, [])
  const run = useCallback(async (action, successMessage) => {
    setBusy(true); setError(''); setNotice('')
    try { await action(); if (successMessage) setNotice(successMessage) }
    catch (failure) { setError(failure.message || 'Não foi possível concluir a operação.') }
    finally { setBusy(false) }
  }, [])

  useEffect(() => {
    if (!signedIn) return
    run(async () => { await loadBooks() })
  }, [signedIn, loadBooks, run])

  const filteredBooks = useMemo(() => books.filter((book) => {
    const text = `${book.titulo || ''} ${display(book.autor)} ${display(book.categoria)} ${book.isbn || ''}`.toLocaleLowerCase('pt-BR')
    const matchesQuery = text.includes(query.toLocaleLowerCase('pt-BR'))
    const matchesCategory = categoryFilter === 'Todas as categorias' || display(book.categoria) === categoryFilter
    return matchesQuery && matchesCategory
  }), [books, query, categoryFilter])
  const categoryNames = useMemo(() => [...new Set(books.map((book) => display(book.categoria)).filter((x) => x !== '—'))], [books])

  async function openReserve(book) {
    setSelectedBook(book); setAvailability([]); setError('')
    try { setAvailability(asList(await request('reservas', `/v1/obras/${encodeURIComponent(book.id)}/disponibilidade`))) }
    catch (failure) { setError(failure.message || 'Não foi possível consultar os exemplares livres.') }
  }

  async function reserve(exemplar) {
    await run(async () => {
      await request('reservas', '/v1/reservas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ obraId: selectedBook.id, exemplarId: copyId(exemplar) }) })
      setSelectedBook(null); await loadReservations()
    }, 'Reserva criada. Você pode acompanhar o status em Minhas reservas.')
  }

  async function loadManageData() {
    const [categoryData, authorData] = await Promise.all([request('acervo', '/v1/categorias'), request('acervo', '/v1/autores')])
    setCategories(asList(categoryData)); setAuthors(asList(authorData))
  }

  async function openCopies(book) {
    await run(async () => {
      const data = await request('acervo', `/v1/obras/${encodeURIComponent(book.id)}/exemplares`)
      setSelectedCopies({ book, copies: asList(data) })
    })
  }

  async function createSupportRecord(service, path, name) {
    const data = await request(service, path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome: name }) })
    await loadManageData()
    return data
  }

  async function doReservationAction(id, action, label) {
    await run(async () => { await request('reservas', `/v1/reservas/${encodeURIComponent(id)}/${action}`, { method: 'POST' }); await loadReservations(page === 'balcao') }, `${label} registrada.`)
  }

  function signIn() { account?.login({ redirectUri: `${window.location.origin}/` }) }
  function signOut() { account?.logout({ redirectUri: `${window.location.origin}/` }) }

  if (!signedIn) return <div className="login-shell">
    <div className="login-art"><span className="eyebrow">BIBLIOGEST · BIBLIOTECA UNIVERSITÁRIA</span><div className="login-quote"><span className="quote-mark">“</span><h1>Há mundos inteiros entre as páginas.</h1><p>Seu próximo capítulo começa no acervo.</p></div><div className="login-foot">ACERVO ACADÊMICO <span>·</span> CONSULTA E CIRCULAÇÃO</div></div>
    <section className="login-panel"><div className="brand-mark">BG</div><span className="eyebrow">BEM-VINDO À BIBLIOTECA</span><h2>Entre na sua conta</h2><p>Use sua conta institucional para consultar o acervo e acompanhar suas reservas.</p><button className="button primary login-button" onClick={signIn} disabled={!auth?.available}>Entrar com a conta institucional <Icon>arrow_forward</Icon></button><button className="register-link" onClick={() => account?.register({ redirectUri: `${window.location.origin}/` })} disabled={!auth?.available}>Primeiro acesso? <strong>Crie sua conta</strong></button>{!auth?.available && <p className="inline-error">Não foi possível carregar a configuração do Keycloak.</p>}<div className="login-security"><Icon>lock</Icon> Acesso seguro via Keycloak · PKCE</div><span className="login-version">BIBLIOGEST · SISTEMA DE BIBLIOTECA</span></section>
  </div>

  const nav = [ ['catalogo', 'Catálogo', 'menu_book'], ['reservas', 'Minhas reservas', 'bookmark'] ]
  if (librarian) nav.push(['gestao', 'Gestão do acervo', 'library_books'], ['balcao', 'Balcão', 'sync_alt'])

  return <div className="app-shell">
    <header className="topbar"><button className="brand" onClick={() => setPage('catalogo')}><span className="brand-mark">BG</span><span><strong>BiblioGest</strong><small>ACERVO ACADÊMICO</small></span></button><nav className="main-nav" aria-label="Navegação principal">{nav.map(([id, label, icon]) => <button key={id} className={page === id ? 'active' : ''} onClick={() => { setPage(id); setError(''); if (id === 'reservas' || id === 'balcao') run(() => loadReservations(id === 'balcao')); if (id === 'gestao') run(loadManageData) }}><Icon>{icon}</Icon>{label}</button>)}</nav><div className="account"><div className="avatar">{user.slice(0, 1).toUpperCase()}</div><div className="account-label"><strong>{user}</strong><small>{librarian ? 'BIBLIOTECÁRIO' : 'LEITOR'}</small></div><button className="icon-button" onClick={signOut} aria-label="Sair"><Icon>logout</Icon></button></div></header>
    <main className="content">
      {error && <div className="toast error" role="alert"><Icon>error</Icon>{error}<button onClick={() => setError('')} aria-label="Fechar">×</button></div>}
      {notice && <div className="toast success" role="status"><Icon>check_circle</Icon>{notice}<button onClick={() => setNotice('')} aria-label="Fechar">×</button></div>}

      {page === 'catalogo' && <>
        <section className="catalog-hero"><div><span className="eyebrow">CONSULTA CATALOGRÁFICA · ACERVO FÍSICO</span><h1>Histórias esperando<br /><em>por você.</em></h1><p>Explore o acervo da biblioteca e encontre sua próxima leitura.</p></div><div className="hero-note"><span>ACERVO VIVO</span><strong>{books.length ? `${books.length} obras` : 'BIBLIOTECA'}</strong><small>ATUALIZADO DIRETO DO ACERVO</small></div></section>
        <section className="catalog-controls"><label className="search-box"><Icon>search</Icon><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Busque por título, autor ou ISBN" /></label><select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} aria-label="Filtrar por categoria"><option>Todas as categorias</option>{categoryNames.map((name) => <option key={name}>{name}</option>)}</select><span className="result-count">{filteredBooks.length} {filteredBooks.length === 1 ? 'OBRA' : 'OBRAS'}</span></section>
        {books.length === 0 ? <div className="empty-state"><Icon>menu_book</Icon><h2>O catálogo está carregando</h2><p>As obras serão exibidas assim que o Acervo responder.</p><button className="button secondary" onClick={() => run(loadBooks)}>Tentar novamente</button></div> : <div className="book-grid">{filteredBooks.map((book) => <article className="book-card" key={book.id}><button className="cover-button" onClick={() => setSelectedBook({ ...book, details: true })} aria-label={`Ver detalhes de ${book.titulo}`}><img className="book-cover" src={book.capaUrl || coverFallback} alt={`Capa de ${book.titulo}`} onError={(event) => { event.currentTarget.src = coverFallback }} /><span className="cover-tag">ACERVO</span></button><div className="book-meta"><span className="category-label">{display(book.categoria)}</span><h2>{book.titulo}</h2><p>{Array.isArray(book.autor) ? book.autor.map(display).join(', ') : display(book.autor)}</p><div className="book-info">{book.volume ? `Vol. ${book.volume}` : 'Exemplar físico'}{book.isbn ? ` · ISBN ${book.isbn}` : ''}</div><button className="button reserve-button" onClick={() => openReserve(book)} disabled={busy}>Consultar disponibilidade <Icon>arrow_forward</Icon></button></div></article>)}</div>}
      </>}

      {page === 'reservas' && <><PageHeading kicker="ÁREA DO LEITOR · CIRCULAÇÃO" title="Minhas reservas" description="Acompanhe os exemplares aguardando retirada e seu histórico de circulação." /><div className="section-bar"><span>{reservations.length} RESERVAS</span><button className="button secondary" onClick={() => run(loadReservations)}><Icon>refresh</Icon> Atualizar</button></div><ReservationList reservations={reservations} onCancel={(id) => doReservationAction(id, 'cancelar', 'Cancelamento')} onOpen={(id) => run(async () => { const detail = await request('reservas', `/v1/reservas/${encodeURIComponent(id)}`); setNotice(`Reserva ${detail.id || id}: ${detail.status || detail.situacao || 'detalhes carregados'}.`) })} /></>}

      {page === 'gestao' && <><PageHeading kicker="BIBLIOTECÁRIO · CURADORIA TÉCNICA" title="Gestão do acervo" description="Consulte o catálogo e cadastre obras diretamente no Acervo institucional." /><div className="section-bar"><span>{books.length} OBRAS NO ACERVO</span><button className="button primary" onClick={() => { setFormOpen(true); run(loadManageData) }}><Icon>add</Icon> Cadastrar obra</button></div><div className="manage-list">{books.map((book) => <article key={book.id} className="manage-row"><img src={book.capaUrl || coverFallback} alt="" /><div><strong>{book.titulo}</strong><small>{display(book.autor)} · {display(book.categoria)}</small></div><span>#{book.id}</span><button className="upload-button" onClick={() => openCopies(book)}>Exemplares</button><label className="upload-button">Enviar capa<input type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; const data = new FormData(); data.append('arquivo', file); run(async () => { await request('acervo', `/v1/obras/${encodeURIComponent(book.id)}/capa`, { method: 'PUT', body: data }); await loadBooks() }, 'Capa atualizada no Acervo.') }} /></label></article>)}</div>{formOpen && <BookForm categories={categories} authors={authors} busy={busy} onClose={() => setFormOpen(false)} onCreateSupport={createSupportRecord} onSubmit={(payload) => run(async () => { await request('acervo', '/v1/obras', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); setFormOpen(false); await loadBooks() }, 'Obra cadastrada no Acervo.')} />}</>}

      {page === 'balcao' && <><PageHeading kicker="BIBLIOTECÁRIO · CIRCULAÇÃO" title="Balcão de retiradas" description="Registre a entrega e a devolução de exemplares reservados." /><div className="section-bar"><span>{reservations.length} RESERVAS</span><button className="button secondary" onClick={() => run(() => loadReservations(true))}><Icon>refresh</Icon> Sincronizar</button></div><ReservationList librarian reservations={reservations} onPickup={(id) => doReservationAction(id, 'retirada', 'Retirada')} onReturn={(id) => doReservationAction(id, 'devolucao', 'Devolução')} /></>}
    </main>

    {selectedBook && <div className="modal-scrim" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedBook(null) }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button className="modal-close" onClick={() => setSelectedBook(null)} aria-label="Fechar">×</button>{selectedBook.details ? <><span className="eyebrow">REGISTRO DO ACERVO</span><h2 id="modal-title">{selectedBook.titulo}</h2><p>{display(selectedBook.autor)} · {display(selectedBook.categoria)}</p><dl className="book-details"><dt>ISBN</dt><dd>{selectedBook.isbn || '—'}</dd><dt>Volume</dt><dd>{selectedBook.volume || '—'}</dd></dl><button className="button primary" onClick={() => openReserve(selectedBook)}>Consultar disponibilidade</button></> : <><span className="eyebrow">RESERVA DE EXEMPLAR</span><h2 id="modal-title">{selectedBook.titulo}</h2><p>Escolha um exemplar livre para enviar sua reserva.</p>{availability.length ? <div className="availability-list">{availability.map((copy) => <div key={copyId(copy)}><span><Icon>check_circle</Icon> Exemplar {(typeof copy === 'object' && (copy.codigo || copy.tombo)) || copyId(copy)}</span><button className="button primary" onClick={() => reserve(copy)} disabled={busy}>Reservar</button></div>)}</div> : <div className="empty-inline">{busy ? 'Consultando exemplares…' : 'Nenhum exemplar livre encontrado no momento.'}</div>}</>}</section></div>}
    {selectedCopies && <div className="modal-scrim"><section className="modal" role="dialog" aria-modal="true"><button className="modal-close" onClick={() => setSelectedCopies(null)} aria-label="Fechar">×</button><span className="eyebrow">TOMBAMENTO FÍSICO</span><h2>Exemplares · {selectedCopies.book.titulo}</h2><div className="availability-list">{selectedCopies.copies.map((copy) => <div key={copy.id}><span>{copy.codigo || copy.tombo || `Exemplar ${copy.id}`} · {copy.status || copy.situacao || 'Cadastrado'}</span></div>)}</div><form className="copy-form" onSubmit={(event) => { event.preventDefault(); run(async () => { await request('acervo', `/v1/obras/${encodeURIComponent(selectedCopies.book.id)}/exemplares`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ codigo: copyCode }) }); setCopyCode(''); const data = await request('acervo', `/v1/obras/${encodeURIComponent(selectedCopies.book.id)}/exemplares`); setSelectedCopies({ ...selectedCopies, copies: asList(data) }) }, 'Exemplar cadastrado no Acervo.') }}><label>Novo exemplar<input required value={copyCode} onChange={(event) => setCopyCode(event.target.value)} placeholder="Código patrimonial" /></label><button className="button primary" disabled={busy}>Adicionar exemplar</button></form></section></div>}
    <footer className="footer"><span>BIBLIOGEST <i>·</i> SISTEMA DE BIBLIOTECA UNIVERSITÁRIA</span><span>ACERVO E CIRCULAÇÃO INSTITUCIONAL</span></footer>
  </div>
}

function PageHeading({ kicker, title, description }) { return <section className="page-heading"><span className="eyebrow">{kicker}</span><h1>{title}</h1><p>{description}</p></section> }

function ReservationList({ reservations, onCancel, onOpen, librarian, onPickup, onReturn }) {
  if (!reservations.length) return <div className="empty-state"><Icon>bookmark</Icon><h2>Nenhuma reserva por aqui</h2><p>Quando houver reservas, elas aparecerão nesta lista.</p></div>
  return <div className="reservation-list">{reservations.map((item) => {
    const id = item.id ?? item.reservaId
    const status = String(item.status || item.situacao || 'AGUARDANDO RETIRADA').toLocaleUpperCase('pt-BR')
    const title = item.obra?.titulo || item.titulo || item.obraTitulo || `Reserva ${id}`
    const waiting = /AGUARD|PENDENTE|PRONTA/.test(status)
    const pickedUp = /RETIR|EMPREST|ATIVA/.test(status)
    return <article className="reservation-row" key={id}><div className="reservation-icon"><Icon>menu_book</Icon></div><div className="reservation-main"><span className="eyebrow">RESERVA #{id}</span><h2>{title}</h2><p>{item.exemplar?.codigo || item.exemplarId ? `Exemplar ${item.exemplar?.codigo || item.exemplarId}` : 'Exemplar físico'} · {item.dataReserva || item.criadaEm || ''}</p></div><span className={`status-stamp ${waiting ? 'waiting' : pickedUp ? 'active' : ''}`}>{status}</span><div className="row-actions">{librarian ? <>{waiting && <button className="button primary" onClick={() => onPickup(id)}>Registrar retirada</button>}{pickedUp && <button className="button secondary" onClick={() => onReturn(id)}>Registrar devolução</button>}</> : <>{waiting && <button className="text-action danger-text" onClick={() => onCancel(id)}>Cancelar reserva</button>}<button className="text-action" onClick={() => onOpen(id)}>Detalhes <Icon>arrow_forward</Icon></button></>}</div></article>
  })}</div>
}

function BookForm({ categories, authors, busy, onClose, onSubmit, onCreateSupport }) {
  const [form, setForm] = useState({ titulo: '', categoriaId: '', autorIds: [], volume: '', isbn: '' })
  const [categoryName, setCategoryName] = useState('')
  const [authorName, setAuthorName] = useState('')
  const [supportError, setSupportError] = useState('')
  const set = (key, value) => setForm((previous) => ({ ...previous, [key]: value }))
  const createCategory = async () => { if (!categoryName.trim()) return; setSupportError(''); try { const created = await onCreateSupport('acervo', '/v1/categorias', categoryName.trim()); if (created?.id != null) set('categoriaId', String(created.id)); setCategoryName('') } catch (failure) { setSupportError(failure.message) } }
  const createAuthor = async () => { if (!authorName.trim()) return; setSupportError(''); try { const created = await onCreateSupport('acervo', '/v1/autores', authorName.trim()); if (created?.id != null) set('autorIds', [...form.autorIds, String(created.id)]); setAuthorName('') } catch (failure) { setSupportError(failure.message) } }
  return <div className="modal-scrim"><form className="modal book-form" onSubmit={(event) => { event.preventDefault(); onSubmit({ titulo: form.titulo, categoriaId: form.categoriaId, autorIds: form.autorIds, ...(form.volume && { volume: form.volume }), ...(form.isbn && { isbn: form.isbn }) }) }}><button type="button" className="modal-close" onClick={onClose} aria-label="Fechar">×</button><span className="eyebrow">ACERVO · NOVO REGISTRO</span><h2>Cadastrar obra</h2><label>Título<input required value={form.titulo} onChange={(event) => set('titulo', event.target.value)} /></label><label>Categoria<select required value={form.categoriaId} onChange={(event) => set('categoriaId', event.target.value)}><option value="">Selecione uma categoria</option>{categories.map((item) => <option key={item.id} value={item.id}>{display(item)}</option>)}</select></label><div className="inline-create"><input aria-label="Nome da nova categoria" value={categoryName} onChange={(event) => setCategoryName(event.target.value)} placeholder="Nova categoria" /><button type="button" className="button secondary" onClick={createCategory}>Cadastrar categoria</button></div><label>Autor(es)<select multiple value={form.autorIds.map(String)} onChange={(event) => set('autorIds', [...event.target.selectedOptions].map((option) => option.value))}>{authors.map((item) => <option key={item.id} value={item.id}>{display(item)}</option>)}</select><small>Use Ctrl ou ⌘ para selecionar mais de um autor.</small></label><div className="inline-create"><input aria-label="Nome do novo autor" value={authorName} onChange={(event) => setAuthorName(event.target.value)} placeholder="Novo autor" /><button type="button" className="button secondary" onClick={createAuthor}>Cadastrar autor</button></div>{supportError && <p className="inline-error" role="alert">{supportError}</p>}<div className="form-pair"><label>Volume (opcional)<input value={form.volume} onChange={(event) => set('volume', event.target.value)} /></label><label>ISBN (opcional)<input value={form.isbn} onChange={(event) => set('isbn', event.target.value)} /></label></div><div className="form-actions"><button type="button" className="button secondary" onClick={onClose}>Cancelar</button><button className="button primary" disabled={busy || !form.categoriaId}>Salvar obra no Acervo</button></div></form></div>
}

export default App
