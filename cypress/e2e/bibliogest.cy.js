const book = {
  id: 'book-1',
  titulo: 'Tokyo Ghoul',
  categoria: { id: 'cat-1', nome: 'Mangá' },
  autor: [{ id: 'author-1', nome: 'Sui Ishida' }],
  descricao: 'Uma sinopse de teste.',
  volume: '1',
  isbn: '9780000000001',
  capaUrl: null,
}
const reservation = {
  id: 'reservation-1',
  obraId: book.id,
  exemplarId: 'copy-1',
  leitorId: 'fixture-reader',
  estado: 'AGUARDANDO_RETIRADA',
  criadaEm: '2026-11-25T10:00:00Z',
}
function visit(roles = ['LEITOR']) {
  let books = Array.from({ length: 13 }, (_, index) => ({
    ...book,
    id: `book-${index + 1}`,
    titulo: index ? `Obra ${index + 1}` : book.titulo,
  }))
  const reservations = []
  cy.intercept('GET', '/config.dev.json', {
    keycloakUrl: 'https://login.example.test',
    realm: 'test',
    clientId: 'test',
    acervoUrl: '/acervo/api',
    reservasUrl: '/reservas/api',
  })
  cy.intercept({ pathname: '/acervo/api/**' }, (req) => {
    expect(req.headers.authorization).to.eq('Bearer fixture-token')
    const url = new URL(req.url)
    if (url.pathname.endsWith('/categorias')) return req.reply([book.categoria])
    if (url.pathname.endsWith('/autores')) return req.reply(book.autor)
    if (url.pathname.endsWith('/exemplares'))
      return req.reply([
        { id: 'copy-1', obraId: book.id, codigoTombo: 'TEST-001' },
      ])
    if (req.method === 'PUT') {
      Object.assign(books[0], req.body)
      return req.reply(books[0])
    }
    if (req.method === 'DELETE') {
      books = books.filter((item) => !url.pathname.endsWith(item.id))
      return req.reply(204)
    }
    if (url.pathname.endsWith('/resumo'))
      return req.reply(
        books.filter((item) =>
          url.searchParams.get('ids').split(',').includes(item.id),
        ),
      )
    const filtered = books.filter((item) =>
      item.titulo
        .toLowerCase()
        .includes((url.searchParams.get('busca') || '').toLowerCase()),
    )
    const page = +(url.searchParams.get('pagina') || 0),
      size = +(url.searchParams.get('tamanho') || 12)
    return req.reply({
      content: filtered.slice(page * size, (page + 1) * size),
      pagina: page,
      tamanho: size,
      totalElementos: filtered.length,
      totalPaginas: Math.ceil(filtered.length / size),
    })
  }).as('acervo')
  cy.intercept({ pathname: '/reservas/api/**' }, (req) => {
    expect(req.headers.authorization).to.eq('Bearer fixture-token')
    if (req.url.includes('/disponibilidade'))
      return req.reply({
        obraId: book.id,
        exemplares: [{ exemplarId: 'copy-1', disponivel: true }],
      })
    if (req.method === 'POST') {
      reservations.push(reservation)
      return req.reply({ statusCode: 201, body: reservation })
    }
    return req.reply(reservations)
  }).as('reservas')
  cy.visit('/', {
    onBeforeLoad(win) {
      win.__testRoles = roles
    },
  })
}
function audit() {
  cy.injectAxe()
  cy.checkA11y(
    null,
    { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } },
    (violations) => {
      if (violations.length)
        cy.task(
          'a11y',
          violations.map(({ id, nodes }) => ({
            id,
            nodes: nodes.map(({ target, failureSummary }) => ({
              target,
              failureSummary,
            })),
          })),
        )
      violations.forEach((violation) =>
        cy.log(
          `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`,
        ),
      )
    },
  )
}
describe('BiblioGest no navegador', () => {
  it('entrada, acessibilidade e logout sem armazenar tokens', () => {
    visit([])
    cy.contains('button', 'Entrar com a conta institucional').should(
      'be.visible',
    )
    audit()
    cy.contains('button', 'Entrar com a conta institucional').click()
    cy.contains('h2', 'Tokyo Ghoul').should('be.visible')
    audit()
    cy.get('button[aria-label="Sair"]').click()
    cy.contains('button', 'Entrar com a conta institucional').should(
      'be.visible',
    )
    cy.window().then((win) =>
      expect(Object.keys(win.localStorage)).to.deep.eq([
        'bibliogest-accessibility',
      ]),
    )
  })
  it('leitor consulta páginas, busca, sinopse e reserva sem comandos administrativos', () => {
    visit()
    cy.contains('h2', 'Tokyo Ghoul').should('be.visible')
    audit()
    cy.contains('button', 'Gestão do acervo').should('not.exist')
    cy.contains('button', 'Balcão').should('not.exist')
    cy.contains('button', 'Próxima página').click()
    cy.contains('Página 2 de 2').should('be.visible')
    cy.get('input[aria-label="Buscar no catálogo"]').type('Tokyo')
    cy.contains('Página 1 de 1').should('be.visible')
    cy.get('button[aria-label="Ver detalhes de Tokyo Ghoul"]').click()
    cy.get('[role="dialog"]').contains('Uma sinopse de teste.')
    audit()
    cy.get('button[aria-label="Fechar"]').click()
    cy.contains('button', 'Consultar disponibilidade').click()
    cy.contains('button', /^Reservar$/).click()
    cy.contains('button', 'Minhas reservas').click()
    cy.contains('button', 'Cancelar reserva').should('be.visible')
  })
  it('bibliotecário edita e exclui com confirmação', () => {
    visit(['LEITOR', 'BIBLIOTECARIO'])
    cy.contains('button', 'Gestão do acervo').click()
    audit()
    cy.contains('button', /^Editar$/)
      .first()
      .click()
    cy.get('[role="dialog"] input').first().clear().type('Tokyo Ghoul revisado')
    audit()
    cy.contains('button', 'Salvar alterações').click()
    cy.contains('strong', 'Tokyo Ghoul revisado').should('be.visible')
    cy.contains('button', /^Excluir$/)
      .first()
      .click()
    cy.contains('button', 'Confirmar exclusão').click()
    cy.contains('Obra excluída do Acervo.').should('be.visible')
  })
  it('preferências, foco e layout em tela pequena', () => {
    cy.viewport(390, 844)
    visit()
    cy.contains('button', /^Acessibilidade$/).click()
    cy.get('[role="dialog"]').should('be.visible')
    cy.get('select').last().select('extra')
    cy.contains('label', 'Alto contraste').click()
    cy.contains('label', 'Reduzir movimento').click()
    cy.get('html')
      .should('have.attr', 'data-contrast', 'true')
      .and('have.attr', 'data-text-size', 'extra')
    audit()
    cy.get('button[aria-label="Fechar acessibilidade"]')
      .focus()
      .trigger('keydown', { key: 'Escape' })
    cy.focused().should('contain.text', 'Acessibilidade')
    audit()
    cy.get('input[aria-label="Buscar no catálogo"]').type('Tokyo')
    cy.get('button[aria-label="Ver detalhes de Tokyo Ghoul"]').click()
    cy.get('[role="dialog"]').should('be.visible')
    cy.document().then((doc) =>
      expect(doc.documentElement.scrollWidth).to.be.at.most(390),
    )
    audit()
  })
})
