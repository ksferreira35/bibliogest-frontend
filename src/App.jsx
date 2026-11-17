import { useEffect, useMemo, useState } from 'react'
import { createBook, createReservation, getBookDetails, getProfile, getReservations, searchBooks, subscribeToChanges, updateReservation } from './api.js'
import './App.css'

const sampleBooks = [
  { title: 'Elogio da Sombra', author: 'Junichiro Tanizaki', genre: 'Ensaio', year: 2017, copies: 3, color: 'wine' },
  { title: 'O Livro do Chá', author: 'Kakuzo Okakura', genre: 'Filosofia', year: 2018, copies: 2, color: 'gold' },
  { title: 'Coração (Kokoro)', author: 'Natsume Soseki', genre: 'Romance', year: 2020, copies: 4, color: 'green' },
  { title: 'A Dança das Sombras', author: 'Yoko Ogawa', genre: 'Ficção', year: 2022, copies: 1, color: 'slate' },
  { title: 'Arquitetura Modular e Cidades do Amanhã', author: 'Kisho Kurokawa', genre: 'Arquitetura', year: 2021, copies: 0, color: 'gold' },
  { title: 'Crônica dos Rios Invisíveis', author: 'Mia Couto', genre: 'Literatura', year: 2019, copies: 2, color: 'green' },
]

function getRole(account) {
  if (!account?.authenticated) return null
  if (account.hasRealmRole?.('BIBLIOTECARIO')) return 'librarian'
  const realmRoles = account.tokenParsed?.realm_access?.roles ?? []
  const clientRoles = Object.values(account.tokenParsed?.resource_access ?? {}).flatMap((entry) => entry.roles ?? [])
  if ([...realmRoles, ...clientRoles].includes('BIBLIOTECARIO')) return 'librarian'
  if ([...realmRoles, ...clientRoles].includes('LEITOR')) return 'reader'
  // Contas autenticadas sem o papel de bibliotecário usam a área de leitor,
  // que é o comportamento padrão adotado pelo projeto.
  return 'reader'
}

function Icon({ name, size = 18 }) {
  const paths = {
    book: <><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M4 4.5v17M8 6h8M8 10h8"/></>,
    home: <><path d="m3 10 9-7 9 7v10H3z"/><path d="M9 20v-7h6v7"/></>,
    search: <><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="1"/><path d="M16 3v4M8 3v4M3 10h18"/></>,
    stack: <><path d="m12 3 9 5-9 5-9-5z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    out: <><path d="M10 17l5-5-5-5M15 12H3"/><path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
    user: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
  }
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>
}

function bookTone(book) {
  if (book.color) return book.color
  return ['wine', 'gold', 'green', 'slate'][Math.abs((book.title || '').length) % 4]
}

function descriptionText(value) {
  if (typeof value === 'string') return value
  return value?.value || 'A Open Library não forneceu uma descrição para esta obra.'
}

function App({ auth }) {
  const account = auth?.keycloak
  const role = getRole(account)
  const [demoRole, setDemoRole] = useState(null)
  const [forceLogin, setForceLogin] = useState(false)
  const activeRole = forceLogin ? null : role || demoRole
  const [page, setPage] = useState('catalog')
  const [query, setQuery] = useState('')
  const [genre, setGenre] = useState('Todos os gêneros')
  const [reservationFilter, setReservationFilter] = useState('')
  const [books, setBooks] = useState(sampleBooks)
  const [loans, setLoans] = useState([])
  const [requests, setRequests] = useState([])
  const [academicId, setAcademicId] = useState('')
  const [notice, setNotice] = useState('')
  const [modal, setModal] = useState(null)
  const [detail, setDetail] = useState(null)
  const [apiError, setApiError] = useState('')
  const [liveSource, setLiveSource] = useState('bibliogest')
  const librarian = activeRole === 'librarian'
  const currentPage = librarian ? (page === 'desk' ? 'desk' : 'inventory') : (page === 'loans' ? 'loans' : 'catalog')

  const visibleBooks = useMemo(() => books.filter((book) => genre === 'Todos os gêneros' || book.genre === genre), [books, genre])

  useEffect(() => {
    if (!activeRole) return undefined
    let cancelled = false
    const timer = window.setTimeout(async () => {
      try {
        const result = await searchBooks(query)
        if (!cancelled) {
          setBooks(result.books)
          setLiveSource(result.source)
          setApiError(result.warning || '')
        }
      } catch (error) {
        if (!cancelled) setApiError(error.message)
      }
    }, query.trim() ? 350 : 0)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [activeRole, query])

  useEffect(() => {
    if (!activeRole || !account?.authenticated) return undefined
    let cancelled = false
    void getProfile().then((result) => { if (!cancelled) setAcademicId(result.profile.academicId) }).catch((error) => { if (!cancelled) setApiError(error.message) })
    const refresh = async () => {
      try {
        const result = await getReservations()
        if (cancelled) return
        setLoans(result.reservations.map((item) => ({ ...item, due: new Date(item.createdAt).toLocaleDateString('pt-BR'), color: 'wine' })))
        setRequests(result.reservations.map((item) => ({ ...item, name: item.userName, date: new Date(item.createdAt).toLocaleString('pt-BR') })))
      } catch (error) {
        if (!cancelled) setApiError(error.message)
      }
    }
    void refresh()
    const unsubscribe = subscribeToChanges((event) => {
      if (event.type === 'books.changed' || event.type === 'reservations.changed') {
        void searchBooks(query).then((result) => { if (!cancelled) setBooks(result.books) }).catch(() => {})
        void refresh()
      }
    })
    return () => { cancelled = true; unsubscribe() }
  }, [activeRole, account?.authenticated, query])

  const go = (next) => { setPage(next); setNotice('') }
  const startLogin = () => { setForceLogin(false); return account?.login({ redirectUri: `${window.location.origin}/` }) }
  const logout = () => {
    setDemoRole(null)
    setForceLogin(true)
    if (account?.authenticated) {
      void account.logout({ redirectUri: `${window.location.origin}/` }).catch(() => {
        account.clearToken()
        window.location.assign('/')
      })
    }
  }
  const showDetails = async (book) => {
    setDetail({ book, loading: true })
    try {
      const result = await getBookDetails(book.key)
      setDetail({ book: result.book || book, details: result.details, warning: result.warning, loading: false })
    } catch (error) {
      setDetail({ book, warning: error.message, loading: false })
    }
  }

  if (!activeRole || forceLogin) return (
    <main className="login-layout">
      <section className="login-art" aria-label="BiblioGest">
        <div className="brand"><span className="brand-mark"><Icon name="book" size={23}/></span><span>Biblio<span className="brand-accent">Gest</span></span></div>
        <div className="login-editorial"><span className="eyebrow">BIBLIOTECA &nbsp;·&nbsp; ACERVO DIGITAL</span><h1>Um mundo de histórias espera por você.</h1><p>Explore o acervo, acompanhe seus empréstimos e descubra sua próxima leitura.</p></div>
        <div className="login-art-footer">CONHECIMENTO QUE APROXIMA <span>EST. 2024</span></div>
      </section>
      <section className="login-panel">
        <div className="login-box"><span className="eyebrow">SEJA BEM-VINDO</span><h2>Entrar na biblioteca</h2><p>Acesse com sua conta institucional para continuar.</p>
          <button className="button button-primary login-button" onClick={startLogin} disabled={!auth?.available}><Icon name="out"/> Entrar com minha conta</button>
          {!auth?.available && <p className="login-help">O login institucional não está configurado neste ambiente.</p>}
          <div className="login-divider"><span>AMBIENTE DE DESENVOLVIMENTO</span></div>
          <p className="demo-copy">Visualize as telas enquanto o Keycloak não está conectado:</p>
          <div className="demo-actions"><button className="button button-secondary" onClick={() => {setForceLogin(false);setDemoRole('reader');go('catalog')}}>Visualizar como leitor</button><button className="button button-secondary" onClick={() => {setForceLogin(false);setDemoRole('librarian');go('inventory')}}>Visualizar como bibliotecário</button></div>
        </div>
        <footer>Ao entrar, você concorda com as políticas de uso da biblioteca.</footer>
      </section>
    </main>
  )

  const nav = librarian
    ? [{ id: 'inventory', label: 'Gestão do acervo', icon: 'stack' }, { id: 'desk', label: 'Reservas e balcão', icon: 'check' }]
    : [{ id: 'catalog', label: 'Catálogo', icon: 'search' }, { id: 'loans', label: 'Minhas reservas', icon: 'calendar' }]

  const reserve = async (book) => {
    try {
      await createReservation(book)
      const result = await getReservations()
      setLoans(result.reservations.map((item) => ({ ...item, due: new Date(item.createdAt).toLocaleDateString('pt-BR'), color: 'wine' })))
      setNotice(`Reserva de “${book.title}” registrada no acervo.`)
    } catch (error) { setNotice(error.message) }
  }

  const confirmRequest = async (request, nextStatus = 'Retirado') => {
    try {
      await updateReservation(request.id, nextStatus)
      const result = await getReservations()
      setRequests(result.reservations.map((item) => ({ ...item, name: item.userName, date: new Date(item.createdAt).toLocaleString('pt-BR') })))
      setNotice('Status da reserva atualizado no acervo.')
      setModal(null)
    } catch (error) { setNotice(error.message); setModal(null) }
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <button className="brand brand-button" onClick={() => go(nav[0].id)}><span className="brand-mark"><Icon name="book" size={22}/></span><span>Biblio<span className="brand-accent">Gest</span></span></button>
      <div className="workspace-label">BIBLIOTECA CENTRAL</div>
      <div className="nav-heading">MENU PRINCIPAL</div>
      <nav className="side-nav" aria-label="Menu principal">{nav.map((item) => <button key={item.id} className={`nav-item ${page === item.id ? 'active' : ''}`} onClick={() => go(item.id)}><Icon name={item.icon}/>{item.label}{item.id === 'loans' && <span className="nav-count">{loans.length}</span>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="help-card"><span className="eyebrow">PRECISA DE AJUDA?</span><p>Fale com a equipe da biblioteca.</p><button onClick={() => setNotice('Atendimento: biblioteca@bibliogest.edu.br')}>Falar com a equipe <span>↗</span></button></div><button className="profile" onClick={logout} title="Sair e voltar para o login"><span className="avatar">{(account?.tokenParsed?.name || (librarian ? 'Bibliotecário' : 'Leitor')).slice(0,1).toUpperCase()}</span><span className="profile-copy"><strong>{account?.tokenParsed?.name || (librarian ? 'Bibliotecário' : 'Leitor')}</strong><small>{librarian ? 'Bibliotecário' : 'Leitor'}</small><small className="academic-id">{academicId || 'Gerando ID acadêmico…'}</small></span><Icon name="out" size={16}/></button></div>
    </aside>

    <main className="main-area">
      <header className="topbar"><div className="breadcrumb">Biblioteca <span>/</span> {nav.find((item) => item.id === currentPage)?.label}</div><div className="topbar-right"><span className="today">BIBLIOGEST <i>•</i> 2026</span><button className="user-chip" onClick={logout}><Icon name="user"/><span>{account?.tokenParsed?.preferred_username || (librarian ? 'Equipe' : 'Minha conta')}</span></button></div></header>
      <div className="page-content">
        {notice && <div className="notice" role="status"><Icon name="check"/>{notice}<button aria-label="Fechar aviso" onClick={() => setNotice('')}>×</button></div>}
        {apiError && !['catalog', 'inventory'].includes(currentPage) && <div className="api-warning" role="status">{apiError}</div>}
        {currentPage === 'catalog' && !librarian && <>
          <section className="page-intro catalog-intro"><div><span className="eyebrow">ACERVO DA BIBLIOTECA</span><h1>Catálogo geral</h1><p>Encontre sua próxima leitura entre os títulos do nosso acervo.</p></div><div className="catalog-total"><strong>{visibleBooks.length}</strong><span>TÍTULOS NESTA LISTA</span></div></section>
          <section className="catalog-tools"><label className="search-field"><Icon name="search"/><input aria-label="Buscar no catálogo" placeholder="Buscar por título ou autor..." value={query} onChange={(event) => setQuery(event.target.value)}/>{query && <button onClick={() => setQuery('')} aria-label="Limpar busca">×</button>}</label><select aria-label="Filtrar por gênero" value={genre} onChange={(event) => setGenre(event.target.value)}>{['Todos os gêneros', ...new Set(books.map((book) => book.genre))].map((item) => <option key={item}>{item}</option>)}</select><span className="results-count">{visibleBooks.length} títulos · {liveSource === 'bibliogest+openlibrary' ? 'BiblioGest + Open Library' : 'Acervo local'} <span className="live-dot" title="API ativa"/></span></section>
          {apiError && <div className="api-warning" role="status">{apiError}</div>}
          <section className="book-grid" aria-label="Livros do catálogo">{visibleBooks.map((book) => <article className="book-card" key={book.key || book.id}><button className={`book-cover ${bookTone(book)}`} onClick={() => showDetails(book)} aria-label={`Ver detalhes de ${book.title}`}>{book.coverId ? <img src={`https://covers.openlibrary.org/b/id/${book.coverId}-M.jpg`} alt={`Capa de ${book.title}`} loading="lazy"/> : <><span className="cover-top">BIBLIOGEST <i>·</i> ACERVO</span><Icon name="book" size={22}/><strong>{book.title}</strong><span className="cover-author">{book.author}</span><small>{book.year || 'SEM DATA'}</small></>}</button><div className="book-info"><span className="book-genre">{book.genre}</span><h2>{book.title}</h2><p>{book.author}</p><button className="detail-link" onClick={() => showDetails(book)}>Ver detalhes <span>↗</span></button><div className="book-meta"><span className={book.copies ? 'available' : 'unavailable'}><i/> {book.copies ? `${book.copies} exemplares disponíveis` : book.source === 'openlibrary' ? 'Referência externa' : 'Indisponível'}</span><button className="icon-button" aria-label={`Reservar ${book.title}`} title="Reservar" disabled={!book.copies || librarian} onClick={() => reserve(book)}><Icon name="plus" size={17}/></button></div></div></article>)}</section>
          {!visibleBooks.length && <div className="empty-state"><Icon name="search" size={25}/><h2>Nenhum título encontrado</h2><p>{apiError || 'Tente buscar por outro título, autor ou gênero.'}</p></div>}
        </>}

        {currentPage === 'loans' && !librarian && <><section className="page-intro"><div><span className="eyebrow">ÁREA DO LEITOR</span><h1>Minhas reservas</h1><p>Acompanhe suas leituras e prazos de devolução.</p></div><div className="summary-box"><strong>{loans.length}</strong><span>EM SUA LISTA</span></div></section><div className="section-heading"><div><h2>Empréstimos e solicitações</h2><p>Seus títulos ativos e reservas recentes.</p></div><button className="button button-secondary" onClick={() => go('catalog')}><Icon name="search"/> Explorar catálogo</button></div><div className="loan-list">{loans.map((loan) => <article className="loan-row" key={loan.code}><div className={`mini-cover ${loan.color}`}><Icon name="book"/></div><div className="loan-title"><h3>{loan.title}</h3><p>{loan.author} <span>·</span> Tombo {loan.code}</p></div><div className="loan-due"><span>{loan.status === 'Em andamento' ? 'DEVOLUÇÃO ATÉ' : 'RESERVADA EM'}</span><strong>{loan.due}</strong></div><span className={`status-stamp ${loan.status === 'Em andamento' ? 'green-stamp' : 'gold-stamp'}`}>{loan.status}</span></article>)}</div><div className="history-note"><span className="eyebrow">LEMBRETE</span><p>Renovações podem ser solicitadas até 48 horas antes do prazo de devolução.</p></div></>}

        {currentPage === 'inventory' && librarian && <><section className="page-intro"><div><span className="eyebrow">ADMINISTRAÇÃO &nbsp;·&nbsp; ACERVO</span><h1>Gestão do acervo</h1><p>Controle obras, exemplares físicos e disponibilidade.</p></div><button className="button button-primary" onClick={() => setModal({ kind: 'book' })}><Icon name="plus"/> Cadastrar obra</button></section><section className="stat-grid"><div className="stat-card"><span>OBRAS NESTA CONSULTA</span><strong>{books.length}</strong><small>Acervo local</small></div><div className="stat-card"><span>EXEMPLARES DISPONÍVEIS</span><strong>{books.reduce((total, book) => total + book.copies, 0)}</strong><small>Acervo físico local</small></div><div className="stat-card"><span>RESERVAS REGISTRADAS</span><strong>{requests.length}</strong><small>Solicitações persistidas</small></div><div className="stat-card"><span>AGUARDANDO RETIRADA</span><strong>{requests.filter((request) => request.status === 'Aguardando retirada').length}</strong><small>Reservas pendentes</small></div></section><div className="section-heading inventory-heading"><div><h2>Acervo geral</h2><p>Registro e disponibilidade dos exemplares.</p></div><label className="search-field compact-search"><Icon name="search"/><input placeholder="Buscar no acervo..." value={query} onChange={(event) => setQuery(event.target.value)}/></label></div>{apiError && <div className="api-warning" role="status">{apiError}</div>}<div className="table-wrap"><table><thead><tr><th>OBRA / AUTOR</th><th>GÊNERO</th><th>ANO</th><th>EXEMPLARES</th><th>DISPONIBILIDADE</th><th></th></tr></thead><tbody>{visibleBooks.map((book) => <tr key={book.key || book.id}><td><strong>{book.title}</strong><small>{book.author}</small></td><td>{book.genre}</td><td>{book.year || '—'}</td><td>{book.copies} exemplares</td><td><span className={`status-stamp ${book.copies ? 'green-stamp' : 'gray-stamp'}`}>{book.copies ? 'Disponível' : book.source === 'openlibrary' ? 'Referência externa' : 'Esgotado'}</span></td><td><button className="text-button" onClick={() => showDetails(book)}>Detalhes</button></td></tr>)}</tbody></table></div></>}

        {currentPage === 'desk' && librarian && <><section className="page-intro"><div><span className="eyebrow">ADMINISTRAÇÃO &nbsp;·&nbsp; CIRCULAÇÃO</span><h1>Reservas e balcão</h1><p>Gerencie solicitações e confirme as retiradas na biblioteca.</p></div><div className="summary-box"><strong>{requests.filter((request) => request.status === 'Aguardando retirada').length}</strong><span>PENDENTES</span></div></section><section className="desk-banner"><div className="desk-icon"><Icon name="check" size={22}/></div><div><strong>Balcão central</strong><p>Confirme a retirada após validar o tombo físico e a credencial do leitor.</p></div><span className="open-stamp"><i/> ATENDIMENTO ATIVO</span></section><div className="section-heading"><div><h2>Controle de reservas</h2><p>Solicitações recentes do acervo.</p></div><select aria-label="Filtrar reservas" onChange={(event) => setReservationFilter(event.target.value)} value={reservationFilter}><option value="">Todas as reservas</option><option value="Aguardando retirada">Aguardando retirada</option><option value="Retirado">Retirado</option><option value="Cancelada">Cancelada</option></select></div><div className="table-wrap"><table><thead><tr><th>LEITOR / ID ACADÊMICO</th><th>OBRA RESERVADA</th><th>TOMBO ÚNICO</th><th>SOLICITAÇÃO</th><th>STATUS</th><th>AÇÃO</th></tr></thead><tbody>{requests.filter((request) => !reservationFilter || request.status === reservationFilter).map((request) => <tr key={request.id}><td><strong>{request.name}</strong><small>{request.academicId || 'ID acadêmico não disponível'}</small></td><td>{request.title}</td><td>{request.code}</td><td>{request.date}</td><td><span className={`status-stamp ${request.status === 'Retirado' ? 'green-stamp' : request.status === 'Cancelada' ? 'gray-stamp' : 'gold-stamp'}`}>{request.status}</span></td><td>{request.status === 'Aguardando retirada' ? <><button className="text-button" onClick={() => setModal({ kind: 'confirm', action: 'pickup', request })}>Confirmar</button><button className="text-button text-button-danger" onClick={() => setModal({ kind: 'confirm', action: 'cancel', request })}>Cancelar</button></> : '—'}</td></tr>)}</tbody></table></div></>}
      </div>
      <footer className="app-footer"><span>BIBLIOGEST <i>·</i> BIBLIOTECA CENTRAL</span><span>UM ESPAÇO PARA DESCOBRIR</span></footer>
    </main>
    {modal && modal.kind === 'book' && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {if (event.target === event.currentTarget) setModal(null)}}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button className="modal-close" onClick={() => setModal(null)} aria-label="Fechar">×</button><span className="eyebrow">NOVO REGISTRO · ACERVO</span><h2 id="modal-title">Cadastrar obra</h2><form onSubmit={async (event) => {event.preventDefault();const form=new FormData(event.currentTarget);try{await createBook({title:form.get('title'),author:form.get('author'),genre:form.get('genre'),year:form.get('year'),copies:form.get('copies')});const result=await searchBooks(query);setBooks(result.books);setNotice('Obra cadastrada no backend.');setModal(null)}catch(error){setNotice(error.message)}}}><label>Título<input name="title" required placeholder="Título da obra"/></label><label>Autor<input name="author" required placeholder="Nome do autor"/></label><label>Gênero<input name="genre" required placeholder="Ex.: Literatura"/></label><label>Ano de publicação<input name="year" type="number" min="0" placeholder="2026"/></label><label>Exemplares disponíveis<input name="copies" type="number" min="0" defaultValue="1"/></label><button className="button button-primary" type="submit">Salvar obra</button></form></section></div>}
    {modal?.kind === 'confirm' && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {if (event.target === event.currentTarget) setModal(null)}}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button className="modal-close" onClick={() => setModal(null)} aria-label="Fechar">×</button><span className="eyebrow">BALCÃO CENTRAL · TOMBO {modal.request.code}</span><h2 id="modal-title">{modal.action === 'cancel' ? 'Cancelar reserva' : 'Confirmar retirada'}</h2><p className="modal-copy">{modal.action === 'cancel' ? <>Confirme o cancelamento da reserva de <strong>{modal.request.title}</strong> para {modal.request.name}. O exemplar volta a ficar disponível.</> : <>Confirme que o exemplar de <strong>{modal.request.title}</strong> foi entregue a {modal.request.name}.</>}</p><button className={`button ${modal.action === 'cancel' ? 'button-danger' : 'button-primary'} modal-action`} onClick={() => void confirmRequest(modal.request, modal.action === 'cancel' ? 'Cancelada' : 'Retirado')}>{modal.action === 'cancel' ? 'Cancelar reserva' : 'Confirmar retirada'}</button></section></div>}
        {detail && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {if (event.target === event.currentTarget) setDetail(null)}}><section className="modal detail-modal" role="dialog" aria-modal="true" aria-labelledby="detail-title"><button className="modal-close" onClick={() => setDetail(null)} aria-label="Fechar">×</button><span className="eyebrow">DETALHES DA OBRA</span><div className="detail-heading"><div className={`detail-cover ${bookTone(detail.book)}`}>{detail.book.coverId && <img src={`https://covers.openlibrary.org/b/id/${detail.book.coverId}-M.jpg`} alt=""/>}<Icon name="book"/></div><div><h2 id="detail-title">{detail.book.title}</h2><p>{detail.book.author}</p><span className="book-genre">{detail.book.genre}</span></div></div><div className="detail-facts"><div><span>PUBLICAÇÃO</span><strong>{detail.details?.first_publish_date || detail.book.year || 'Não informada'}</strong></div><div><span>EDIÇÕES</span><strong>{detail.book.editionCount || '—'}</strong></div><div><span>EXEMPLARES LOCAIS</span><strong>{detail.book.copies}</strong></div></div><p className="detail-description">{detail.loading ? 'Carregando dados bibliográficos…' : descriptionText(detail.details?.description)}</p>{detail.warning && <p className="api-warning">{detail.warning}</p>}<div className="detail-actions">{detail.book.source === 'openlibrary' && detail.book.key?.startsWith('/works/') ? <a className="button button-secondary" href={`https://openlibrary.org${detail.book.key}`} target="_blank" rel="noreferrer">Abrir na Open Library ↗</a> : <span className="detail-source">Obra cadastrada no acervo BiblioGest</span>}{!librarian && <button className="button button-primary" disabled={!detail.book.copies} onClick={() => {void reserve(detail.book);setDetail(null)}}>Reservar exemplar</button>}</div></section></div>}
  </div>
}

export default App
